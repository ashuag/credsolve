import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LOAN_REPAYMENT_STATUS } from '../constants/loan-repayment.constants';
import { closeLoanStatusName, isClosedLoanStatus, LOAN_STATUS } from '../constants/loan.constants';
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
import { billDueNowAfterWaiverInr, waivedAmountFromLoan } from '../loan/loan-charge-waiver.util';
import {
  remainingDueInr,
  shouldCloseLoanAfterPayment,
  sumSuccessfulRepaymentsInr,
} from '../loan/loan-repayment-outstanding.util';
import { loadRepayCoolingPeriodDays } from '../loan/repay-cooling-period.util';
import { NocLetterService } from '../noc/noc-letter.service';
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
  remainingAfterInr: number;
  repaymentStatus: 'SUCCESS' | 'PARTIAL';
  repaymentUuid: string | null;
};

@Injectable()
export class SettleEasebuzzRepaymentService {
  private readonly logger = new Logger(SettleEasebuzzRepaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
    private readonly nocLetter: NocLetterService,
  ) {}

  async findSuccessByVendorRef(txnid: string): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM loan_repayment
      WHERE vendor_ref = ${txnid.slice(0, 50)}
        AND status IN (${LOAN_REPAYMENT_STATUS.SUCCESS}, ${LOAN_REPAYMENT_STATUS.PARTIAL})
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
    /** Unique Easebuzz payment id (`easepayid` when present). Defaults to txnid. */
    vendorRef?: string;
    amountInr: string;
    bankRef: string;
    paidAt?: Date;
  }): Promise<SettleEasebuzzPaymentResult> {
    const txnid = input.txnid.trim().slice(0, 50);
    const vendorRef = (input.vendorRef?.trim() || txnid).slice(0, 50);
    const amountInr = input.amountInr.trim();
    const paidThis = Number.parseFloat(amountInr);
    if (!txnid || !vendorRef || !Number.isFinite(paidThis) || paidThis <= 0) {
      throw new Error('invalid_settle_amount');
    }

    if (await this.findSuccessByVendorRef(vendorRef)) {
      await this.clearIntent(input.loan.uuid, txnid);
      // Already settled — still try NOC if the loan is closed and letter was never sent.
      this.nocLetter.scheduleIssueIfNeeded(input.loan.id);
      return {
        alreadySettled: true,
        closedLoan: false,
        remainingAfterInr: 0,
        repaymentStatus: LOAN_REPAYMENT_STATUS.SUCCESS,
        repaymentUuid: null,
      };
    }

    const principal = decimalToNumber(input.loan.principalAmount);
    const dailyRate = decimalToNumber(input.loan.interestRate);
    const coolingPeriodDays = await loadRepayCoolingPeriodDays(this.prisma.client);

    const loanStatus = await this.prisma.client.loanAccount.findUnique({
      where: { id: input.loan.id },
      select: { loanStatus: { select: { name: true } }, closedAt: true, waivedAmount: true },
    });
    if (loanStatus?.closedAt != null || isClosedLoanStatus(loanStatus?.loanStatus.name)) {
      await this.clearIntent(input.loan.uuid, txnid);
      this.nocLetter.scheduleIssueIfNeeded(input.loan.id);
      return {
        alreadySettled: true,
        closedLoan: true,
        remainingAfterInr: 0,
        repaymentStatus: LOAN_REPAYMENT_STATUS.SUCCESS,
        repaymentUuid: null,
      };
    }

    const pastDue =
      loanStatus?.loanStatus.name === LOAN_STATUS.OVERDUE ||
      isRepaymentPastDue(input.loan.loanMaturityDate);
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(input.loan.loanMaturityDate), 1)
      : 0;
    const due =
      principal != null && dailyRate != null
        ? computeAmountDueNowInr(principal, dailyRate, input.loan.disbursedAt, {
            coolingPeriodDays,
            tenureDays: computeTenureDays(input.loan.disbursedAt, input.loan.loanMaturityDate),
            overdueDays,
          })
        : null;
    const bounceFeeInr =
      principal != null
        ? await this.bounceChargeTiers.resolveChargeForAmount(principal, overdueDays)
        : 0;
    const bill =
      due != null
        ? billDueNowAfterWaiverInr({
            amountDueBeforePenal: due.amountDue,
            penalInr: bounceFeeInr,
            overdueInterestInr: due.overdueInterestAmount,
            waivedAmountInr: waivedAmountFromLoan(loanStatus?.waivedAmount),
          })
        : null;
    const billDueNow = bill?.billDueNow ?? paidThis;
    const closeStatusName = closeLoanStatusName(bill?.appliedWaiverInr ?? 0);

    const closedStatus =
      (await this.prisma.client.loanStatus.findFirst({
        where: { name: closeStatusName, isActive: true },
        select: { id: true },
      })) ??
      (closeStatusName === LOAN_STATUS.SETTLED
        ? await this.prisma.client.loanStatus.findFirst({
            where: { name: LOAN_STATUS.CLOSED, isActive: true },
            select: { id: true },
          })
        : null);

    const lockKey = `customer:repay-settle:${vendorRef}`;
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
      if (await this.findSuccessByVendorRef(vendorRef)) {
        await this.clearIntent(input.loan.uuid, txnid);
        return {
          alreadySettled: true,
          closedLoan: false,
          remainingAfterInr: 0,
          repaymentStatus: LOAN_REPAYMENT_STATUS.SUCCESS,
          repaymentUuid: null,
        };
      }
      throw new Error('settle_in_progress');
    }

    const repaymentUuid = randomUUID();
    const paidAt = input.paidAt ?? new Date();
    let closedLoan = false;
    let remainingAfterInr = 0;
    let repaymentStatus: 'SUCCESS' | 'PARTIAL' = LOAN_REPAYMENT_STATUS.SUCCESS;

    try {
      if (await this.findSuccessByVendorRef(vendorRef)) {
        await this.clearIntent(input.loan.uuid, txnid);
        return {
          alreadySettled: true,
          closedLoan: false,
          remainingAfterInr: 0,
          repaymentStatus: LOAN_REPAYMENT_STATUS.SUCCESS,
          repaymentUuid: null,
        };
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
          remainingAfterInr = 0;
          repaymentStatus = LOAN_REPAYMENT_STATUS.SUCCESS;
          return;
        }

        const existing = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM loan_repayment
          WHERE vendor_ref = ${vendorRef}
            AND status IN (${LOAN_REPAYMENT_STATUS.SUCCESS}, ${LOAN_REPAYMENT_STATUS.PARTIAL})
          LIMIT 1
        `;
        if (existing[0]) {
          return;
        }

        const paidBefore = await sumSuccessfulRepaymentsInr(tx, input.loan.id);
        remainingAfterInr = remainingDueInr(billDueNow, paidBefore + paidThis);
        const closesLoan = shouldCloseLoanAfterPayment(remainingAfterInr);
        repaymentStatus = closesLoan
          ? LOAN_REPAYMENT_STATUS.SUCCESS
          : LOAN_REPAYMENT_STATUS.PARTIAL;

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
            ${repaymentStatus},
            ${input.bankRef.trim().slice(0, 50)},
            ${null},
            ${vendorRef},
            ${paidAt},
            ${paidAt}
          )
        `;

        if (closesLoan && !closedStatus) {
          this.logger.error('[repay-settle] CLOSED loan status missing');
          throw new Error('status_missing');
        }

        if (closesLoan && closedStatus) {
          const bookedInterest = due?.interestAmount;
          const bookedRepayable =
            principal != null && bookedInterest != null
              ? Math.round((principal + bookedInterest) * 100) / 100
              : null;
          await tx.loanAccount.update({
            where: { id: input.loan.id },
            data: {
              loanStatusId: closedStatus.id,
              closedAt: paidAt,
              ...(bookedInterest != null ? { interestAmount: bookedInterest.toFixed(2) } : {}),
              ...(bookedRepayable != null
                ? { totalRepaymentAmount: bookedRepayable.toFixed(2) }
                : {}),
            },
          });
        }

        if (closesLoan) {
          closedLoan = true;
          remainingAfterInr = 0;

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
    if (closedLoan) {
      this.nocLetter.scheduleIssueIfNeeded(input.loan.id);
    }
    this.logger.log(
      `[repay-settle] ${repaymentStatus} loan=${input.loan.loanNumber} txnid=${txnid} ` +
        `vendorRef=${vendorRef} repayment=${repaymentUuid} closed=${closedLoan} remaining=${remainingAfterInr}`,
    );
    return {
      alreadySettled: false,
      closedLoan,
      remainingAfterInr,
      repaymentStatus,
      repaymentUuid,
    };
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
