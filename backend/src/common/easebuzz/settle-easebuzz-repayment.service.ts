import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LOAN_REPAYMENT_STATUS } from '../constants/loan-repayment.constants';
import { LOAN_STATUS } from '../constants/loan.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { BounceChargeTierResolverService } from '../loan/bounce-charge-tier.resolver';
import { isRepaymentPastDue, overdueDaysFromMaturity } from '../loan/bounce-charge.util';
import { canDeactivateConvertedLeadForReapply } from '../loan/customer-open-loan.util';
import {
  computeAmountDueNowInr,
  computeTenureDays,
  decimalToNumber,
  type DecimalLike,
} from '../loan/loan-calculation.util';
import {
  remainingDueInr,
  shouldCloseLoanAfterPayment,
  sumSuccessfulRepaymentsInr,
} from '../loan/loan-repayment-outstanding.util';
import { loadRepayCoolingPeriodDays } from '../loan/repay-cooling-period.util';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  clearPendingRepayIntent,
  forgetLoanRepayTxnid,
} from './repay-intent.util';

const SETTLE_LOCK_TTL_SEC = 120;

export type SettleEasebuzzLoanRef = {
  id: bigint;
  uuid: string;
  loanNumber: string;
  principalAmount: DecimalLike;
  interestRate: DecimalLike;
  disbursedAt: Date;
  loanMaturityDate: Date;
  application: { uuid: string; leadId: bigint };
};

export type SettleEasebuzzPaymentResult = {
  alreadySettled: boolean;
  closedLoan: boolean;
  repaymentUuid: string | null;
};

@Injectable()
export class SettleEasebuzzRepaymentService {
  private readonly logger = new Logger(SettleEasebuzzRepaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
  ) {}

  async findSuccessByVendorRef(txnid: string): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM loan_repayment
      WHERE vendor_ref = ${txnid.slice(0, 50)}
        AND status = ${LOAN_REPAYMENT_STATUS.SUCCESS}
      LIMIT 1
    `;
    return Boolean(rows[0]);
  }

  /**
   * Record a confirmed Easebuzz payment and close the loan when remaining is zero.
   * Idempotent on vendor_ref. Same lock + FOR UPDATE path as the surl/furl callback.
   */
  async settleSuccessfulPayment(input: {
    loan: SettleEasebuzzLoanRef;
    txnid: string;
    amountInr: string;
    bankRef: string;
    paidAt?: Date;
  }): Promise<SettleEasebuzzPaymentResult> {
    const txnid = input.txnid.trim().slice(0, 50);
    const amountInr = input.amountInr.trim();
    const paidThis = Number.parseFloat(amountInr);
    if (!txnid || !Number.isFinite(paidThis) || paidThis <= 0) {
      throw new Error('invalid_settle_amount');
    }

    if (await this.findSuccessByVendorRef(txnid)) {
      await this.clearIntent(input.loan.uuid, txnid);
      return { alreadySettled: true, closedLoan: false, repaymentUuid: null };
    }

    const principal = decimalToNumber(input.loan.principalAmount);
    const dailyRate = decimalToNumber(input.loan.interestRate);
    const coolingPeriodDays = await loadRepayCoolingPeriodDays(this.prisma.client);
    const due =
      principal != null && dailyRate != null
        ? computeAmountDueNowInr(principal, dailyRate, input.loan.disbursedAt, {
            coolingPeriodDays,
            tenureDays: computeTenureDays(input.loan.disbursedAt, input.loan.loanMaturityDate),
          })
        : null;

    const loanStatus = await this.prisma.client.loanAccount.findUnique({
      where: { id: input.loan.id },
      select: { loanStatus: { select: { name: true } }, closedAt: true },
    });
    if (loanStatus?.closedAt != null || loanStatus?.loanStatus.name === LOAN_STATUS.CLOSED) {
      await this.clearIntent(input.loan.uuid, txnid);
      return { alreadySettled: true, closedLoan: true, repaymentUuid: null };
    }

    const pastDue =
      loanStatus?.loanStatus.name === LOAN_STATUS.OVERDUE ||
      isRepaymentPastDue(input.loan.loanMaturityDate);
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(input.loan.loanMaturityDate), 1)
      : 0;
    const bounceFeeInr =
      principal != null
        ? await this.bounceChargeTiers.resolveChargeForAmount(principal, overdueDays)
        : 0;
    const billDueNow =
      due != null ? Math.round((due.amountDue + bounceFeeInr) * 100) / 100 : paidThis;

    const closedStatus = await this.prisma.client.loanStatus.findFirst({
      where: { name: LOAN_STATUS.CLOSED, isActive: true },
      select: { id: true },
    });

    const lockKey = `customer:repay-settle:${txnid}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.client.set(
      lockKey,
      lockToken,
      'EX',
      SETTLE_LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') {
      await new Promise((r) => setTimeout(r, 800));
      if (await this.findSuccessByVendorRef(txnid)) {
        await this.clearIntent(input.loan.uuid, txnid);
        return { alreadySettled: true, closedLoan: false, repaymentUuid: null };
      }
      throw new Error('settle_in_progress');
    }

    const repaymentUuid = randomUUID();
    const paidAt = input.paidAt ?? new Date();
    let closedLoan = false;

    try {
      if (await this.findSuccessByVendorRef(txnid)) {
        await this.clearIntent(input.loan.uuid, txnid);
        return { alreadySettled: true, closedLoan: false, repaymentUuid: null };
      }

      await this.prisma.client.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: bigint; closed_at: Date | null }>>`
          SELECT id, closed_at
          FROM loan_account
          WHERE id = ${input.loan.id}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new Error('loan_missing');
        }
        if (locked[0].closed_at != null) {
          closedLoan = true;
          return;
        }

        const existing = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM loan_repayment
          WHERE vendor_ref = ${txnid}
            AND status = ${LOAN_REPAYMENT_STATUS.SUCCESS}
          LIMIT 1
        `;
        if (existing[0]) {
          return;
        }

        const paidBefore = await sumSuccessfulRepaymentsInr(tx, input.loan.id);
        const remainingAfter = remainingDueInr(billDueNow, paidBefore + paidThis);
        const closesLoan = shouldCloseLoanAfterPayment(remainingAfter);

        await tx.$executeRaw`
          INSERT INTO loan_repayment (
            uuid,
            loan_account_id,
            amount,
            payment_mode,
            status,
            utr,
            failure_message,
            vendor_ref,
            paid_at,
            created_at
          ) VALUES (
            ${repaymentUuid},
            ${input.loan.id},
            ${amountInr},
            ${'UPI'},
            ${LOAN_REPAYMENT_STATUS.SUCCESS},
            ${input.bankRef.trim().slice(0, 50)},
            ${null},
            ${txnid},
            ${paidAt},
            ${paidAt}
          )
        `;

        if (closesLoan) {
          if (!closedStatus) {
            this.logger.error('[repay-settle] CLOSED loan status missing');
            throw new Error('status_missing');
          }
          const collected = Math.round((paidBefore + paidThis) * 100) / 100;
          await tx.loanAccount.update({
            where: { id: input.loan.id },
            data: {
              loanStatusId: closedStatus.id,
              closedAt: paidAt,
              interestAmount: due ? due.interestAmount.toFixed(2) : undefined,
              totalRepaymentAmount: collected.toFixed(2),
            },
          });
          closedLoan = true;

          const lead = await tx.lead.findUnique({
            where: { id: input.loan.application.leadId },
            select: { id: true, leadStatus: { select: { name: true } } },
          });
          if (lead?.leadStatus.name === LEAD_STATUS.CONVERTED) {
            const mayReapply = await canDeactivateConvertedLeadForReapply(tx, lead.id);
            if (mayReapply) {
              await tx.lead.update({
                where: { id: lead.id },
                data: { isActive: false },
              });
            }
          }
        }
      });
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }

    await this.clearIntent(input.loan.uuid, txnid);
    this.logger.log(
      `[repay-settle] SUCCESS loan=${input.loan.loanNumber} txnid=${txnid} ` +
        `repayment=${repaymentUuid} closed=${closedLoan}`,
    );
    return { alreadySettled: false, closedLoan, repaymentUuid };
  }

  private async clearIntent(loanAccountUuid: string, txnid: string): Promise<void> {
    await clearPendingRepayIntent(this.redis, txnid);
    await forgetLoanRepayTxnid(this.redis, loanAccountUuid, txnid);
  }

  private async releaseLock(lockKey: string, lockToken: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await this.redis.client.eval(script, 1, lockKey, lockToken);
    } catch (error) {
      this.logger.warn(
        `[repay-settle] Failed to release lock ${lockKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
