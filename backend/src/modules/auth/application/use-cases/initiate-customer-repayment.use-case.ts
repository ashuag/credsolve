import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { EasebuzzWireService } from '../../../../common/easebuzz/easebuzz-wire.service';
import { savePendingRepayIntent } from '../../../../common/easebuzz/repay-intent.util';
import { LOAN_REPAYMENT_STATUS } from '../../../../common/constants/loan-repayment.constants';
import { LOAN_STATUS } from '../../../../common/constants/loan.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import {
  computeAmountDueNowInr,
  decimalToNumber,
} from '../../../../common/loan/loan-calculation.util';
import {
  isRepaymentPastDue,
  overdueDaysFromMaturity,
} from '../../../../common/loan/bounce-charge.util';
import { BounceChargeTierResolverService } from '../../../../common/loan/bounce-charge-tier.resolver';
import { canDeactivateConvertedLeadForReapply } from '../../../../common/loan/customer-open-loan.util';
import { RedisService } from '../../../../common/redis/redis.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';

const REPAY_LOCK_TTL_SEC = 90;

/** Easebuzz txnid: loan_number + current timestamp (max 40 chars). */
function buildPayTxnId(loanNumber: string): string {
  const compact = loanNumber.replace(/[^a-zA-Z0-9_|\/-]/g, '').slice(0, 27);
  const ts = String(Date.now());
  return `${compact}${ts}`.slice(0, 40);
}

function truncateError(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

@Injectable()
export class InitiateCustomerRepaymentUseCase {
  private readonly logger = new Logger(InitiateCustomerRepaymentUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly redis: RedisService,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
  ) {}

  async execute(
    req: Request,
    applicationUuid: string,
  ): Promise<{
    success: true;
    applicationUuid: string;
    loanAccountUuid: string;
    loanNumber: string;
    amountInr: string;
    bounceFeeInr: string;
    repaymentUuid: string | null;
    loanStatus: string;
    redirectPath: string;
    paymentUrl: string | null;
    vendor: 'easebuzz' | 'skipped';
  }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lockKey = `customer:repay-lock:${applicationUuid}:${customer.uuid}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.client.set(lockKey, lockToken, 'EX', REPAY_LOCK_TTL_SEC, 'NX');
    if (acquired !== 'OK') {
      throw new ConflictException('Repayment is already in progress. Please wait a moment.');
    }

    try {
      return await this.initiateLocked(customer.id, applicationUuid);
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  private async initiateLocked(customerId: bigint, applicationUuid: string) {
    const application = await this.prisma.client.application.findFirst({
      where: { uuid: applicationUuid, customerId },
      select: {
        id: true,
        uuid: true,
        leadId: true,
        details: { select: { emailId: true } },
        lead: { select: { leadDetail: { select: { fullName: true } } } },
        customer: { select: { mobileNumber: true } },
        loanAccount: {
          select: {
            id: true,
            uuid: true,
            loanNumber: true,
            principalAmount: true,
            interestRate: true,
            disbursedAt: true,
            loanMaturityDate: true,
            closedAt: true,
            loanStatus: { select: { name: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    const loan = application.loanAccount;
    if (!loan) {
      throw new BadRequestException('No disbursed loan found for this application.');
    }
    if (loan.closedAt != null || loan.loanStatus.name === LOAN_STATUS.CLOSED) {
      throw new ConflictException('This loan is already closed.');
    }
    if (
      loan.loanStatus.name !== LOAN_STATUS.ACTIVE &&
      loan.loanStatus.name !== LOAN_STATUS.OVERDUE
    ) {
      throw new BadRequestException(`Loan status ${loan.loanStatus.name} cannot be repaid online.`);
    }

    const principal = decimalToNumber(loan.principalAmount);
    const dailyRate = decimalToNumber(loan.interestRate);
    if (principal == null || dailyRate == null) {
      throw new BadRequestException('Unable to compute repayment amount for this loan.');
    }

    const due = computeAmountDueNowInr(principal, dailyRate, loan.disbursedAt);
    if (!(due.amountDue > 0)) {
      throw new BadRequestException('Nothing due on this loan right now.');
    }

    // Late repayment (after maturity / OVERDUE): bounce accrues per overdue day at the rate for
    // the principal band, capped. A loan flagged OVERDUE bills at least one day.
    const pastDue =
      loan.loanStatus.name === LOAN_STATUS.OVERDUE || isRepaymentPastDue(loan.loanMaturityDate);
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(loan.loanMaturityDate), 1)
      : 0;
    const bounceFeeInr = await this.bounceChargeTiers.resolveChargeForAmount(
      principal,
      overdueDays,
    );
    const totalDue = Math.round((due.amountDue + bounceFeeInr) * 100) / 100;

    const amountInr = totalDue.toFixed(2);
    const bounceFeeInrStr = bounceFeeInr.toFixed(2);
    const txnid = buildPayTxnId(loan.loanNumber);
    const paidAt = new Date();

    let vendor: 'easebuzz' | 'skipped' = 'skipped';
    let vendorRef: string | null = txnid;
    let paymentUrl: string | null = null;

    if (this.easebuzzWire.isPayInitiateSkipped()) {
      this.logger.warn(
        `[repay] EASEBUZZ_PAY_SKIP — settling loan=${loan.loanNumber} amount=${amountInr} ` +
          `bounce=${bounceFeeInrStr} (${overdueDays}d overdue) without vendor call`,
      );
    } else {
      const payeeName = application.lead.leadDetail?.fullName?.trim();
      const payeeEmail = application.details?.emailId?.trim();
      const payeePhone = application.customer.mobileNumber.replace(/\D/g, '');
      if (!payeeName || !payeeEmail || payeePhone.length < 10) {
        throw new BadRequestException(
          'Borrower name, email, and mobile are required before repayment.',
        );
      }

      try {
        // Amount = principal + interest (+ bounce fee when past due), always 2 decimal places.
        // txnid = loan_number + current timestamp (unique per attempt).
        const created = await this.easebuzzWire.initiatePaymentLink({
          txnid,
          amountInr: totalDue,
          productinfo: `Loan repay ${loan.loanNumber}`.slice(0, 45),
          firstname: payeeName,
          email: payeeEmail,
          phone: payeePhone.slice(-10),
          surl: '',
          furl: '',
          leadId: application.leadId,
          udf1: loan.uuid,
          udf2: application.uuid,
          udf3: loan.loanNumber,
          udf4: amountInr,
          udf5: bounceFeeInrStr,
        });
        vendor = 'easebuzz';
        vendorRef = created.txnid.slice(0, 50);
        paymentUrl = created.paymentUrl;
        await savePendingRepayIntent(this.redis, created.txnid, {
          loanAccountId: loan.id.toString(),
          loanAccountUuid: loan.uuid,
          applicationUuid: application.uuid,
          loanNumber: loan.loanNumber,
          amountInr,
          bounceFeeInr: bounceFeeInrStr,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? truncateError(error.message)
            : 'Repayment payment failed at Easebuzz.';
        await this.recordFailedAttempt({
          loanAccountId: loan.id,
          amountInr,
          uniqueCode: txnid,
          failureMessage: message,
          paidAt,
        });
        this.logger.error(
          `[repay] Failed loan=${loan.loanNumber} amount=${amountInr}: ${message}`,
        );
        throw new BadGatewayException(
          'Payment was unsuccessful. Please try again or contact support. The failure has been recorded on your loan.',
        );
      }

      // Hosted Easebuzz payment URL — customer must complete payment; do not close the loan yet.
      if (paymentUrl) {
        this.logger.log(
          `[repay] Pay initiateLink created loan=${loan.loanNumber} txnid=${txnid} amount=${amountInr} — awaiting customer payment`,
        );
        return {
          success: true as const,
          applicationUuid: application.uuid,
          loanAccountUuid: loan.uuid,
          loanNumber: loan.loanNumber,
          amountInr,
          bounceFeeInr: bounceFeeInrStr,
          repaymentUuid: null,
          loanStatus: loan.loanStatus.name,
          redirectPath: '/my-account',
          paymentUrl,
          vendor,
        };
      }
    }

    const closedStatus = await this.prisma.client.loanStatus.findFirst({
      where: { name: LOAN_STATUS.CLOSED, isActive: true },
      select: { id: true },
    });
    if (!closedStatus) {
      throw new NotFoundException('CLOSED loan status is not configured.');
    }

    const repaymentUuid = randomUUID();

    await this.prisma.client.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint; closed_at: Date | null }>>`
        SELECT id, closed_at
        FROM loan_account
        WHERE id = ${loan.id}
        FOR UPDATE
      `;
      if (!locked[0]) {
        throw new NotFoundException('Loan account not found.');
      }
      if (locked[0].closed_at != null) {
        throw new ConflictException('This loan is already closed.');
      }

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
          ${loan.id},
          ${amountInr},
          ${'UPI'},
          ${LOAN_REPAYMENT_STATUS.SUCCESS},
          ${vendorRef},
          ${null},
          ${txnid},
          ${paidAt},
          ${paidAt}
        )
      `;

      await tx.loanAccount.update({
        where: { id: loan.id },
        data: {
          loanStatusId: closedStatus.id,
          closedAt: paidAt,
          interestAmount: due.interestAmount.toFixed(2),
          totalRepaymentAmount: amountInr,
        },
      });

      // Free the customer to start a fresh application (do not keep journey locked on /thank-you).
      const lead = await tx.lead.findUnique({
        where: { id: application.leadId },
        select: { id: true, leadStatus: { select: { name: true } } },
      });
      if (lead?.leadStatus.name === LEAD_STATUS.CONVERTED) {
        const mayReapply = await canDeactivateConvertedLeadForReapply(tx, lead.id);
        if (mayReapply) {
          await this.leads.deactivate(lead.id, tx);
        }
      }
    });

    this.logger.log(
      `[repay] Success loan=${loan.loanNumber} amount=${amountInr} vendor=${vendor} repayment=${repaymentUuid}`,
    );

    return {
      success: true as const,
      applicationUuid: application.uuid,
      loanAccountUuid: loan.uuid,
      loanNumber: loan.loanNumber,
      amountInr,
      bounceFeeInr: bounceFeeInrStr,
      repaymentUuid,
      loanStatus: LOAN_STATUS.CLOSED,
      redirectPath: '/my-account',
      paymentUrl: null,
      vendor,
    };
  }

  private async recordFailedAttempt(input: {
    loanAccountId: bigint;
    amountInr: string;
    uniqueCode: string;
    failureMessage: string;
    paidAt: Date;
  }): Promise<void> {
    try {
      await this.prisma.client.$executeRaw`
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
          ${randomUUID()},
          ${input.loanAccountId},
          ${input.amountInr},
          ${'UPI'},
          ${LOAN_REPAYMENT_STATUS.FAILED},
          ${null},
          ${input.failureMessage},
          ${input.uniqueCode},
          ${input.paidAt},
          ${input.paidAt}
        )
      `;
    } catch (error) {
      this.logger.warn(
        `[repay] Could not persist FAILED repayment attempt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
        `[repay] Failed to release lock ${lockKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
