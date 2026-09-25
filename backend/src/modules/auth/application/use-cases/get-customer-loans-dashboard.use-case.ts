import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { LOAN_REPAYMENT_STATUS, COLLECTED_REPAYMENT_STATUSES } from '../../../../common/constants/loan-repayment.constants';
import { LOAN_STATUS } from '../../../../common/constants/loan.constants';
import {
  computeAmountDueNowInr,
  computeInterestAmountInr,
  calendarDaysBetween,
  resolveContractedTenureDays,
  decimalToNumber,
} from '../../../../common/loan/loan-calculation.util';
import {
  computePenalChargeInr,
  isRepaymentPastDue,
  overdueDaysFromMaturity,
  type PenalChargeConfig,
} from '../../../../common/loan/bounce-charge.util';
import { billDueNowAfterWaiverInr, waivedAmountFromLoan } from '../../../../common/loan/loan-charge-waiver.util';
import {
  remainingDueInr,
  sumRepaymentAmounts,
} from '../../../../common/loan/loan-repayment-outstanding.util';
import { listLoanRepayTxnids } from '../../../../common/easebuzz/repay-intent.util';
import { BounceChargeTierResolverService } from '../../../../common/loan/bounce-charge-tier.resolver';
import { RedisService } from '../../../../common/redis/redis.service';
import { LosLoanRepaymentSyncService } from '../../../los/services/los-loan-repayment-sync.service';
import { computeFeeAmountsFromLoanDetail } from '../../../../common/loan/loan-disbursement-view.util';
import {
  overlayLiveRepaymentDueDateIfSelected,
  resolveRepaymentDueDateUtc,
} from '../../../../common/loan/repayment-due-date.util';
import type {
  CustomerLoanCard,
  CustomerLoanRepaymentLine,
  CustomerLoansDashboardResult,
} from '../contracts/customer-loans-dashboard.contract';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

function isTerminalApplicationStatus(
  statusName: string,
  loanDocumentsAcceptedAt?: Date | null,
): boolean {
  if (statusName === APPLICATION_STATUS.REJECTED || statusName === APPLICATION_STATUS.KYC_FAILED) {
    return true;
  }
  // Penny-drop failure stays in-progress until the customer finishes references / eSign.
  return statusName === APPLICATION_STATUS.PENNYDROP_FAILED && loanDocumentsAcceptedAt != null;
}

function decToAmountString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  const n = value.toNumber();
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function maskBank(bankName: string | null | undefined, accountNumber: string | null | undefined): string | null {
  const bank = bankName?.trim();
  const tail = accountNumber?.replace(/\D/g, '').slice(-4);
  if (bank && tail) return `${bank} ••••${tail}`;
  if (bank) return bank;
  if (tail) return `Account ••••${tail}`;
  return null;
}

function isDisbursedRow(disbursedAt: Date | null | undefined, statusName: string): boolean {
  return disbursedAt != null || statusName === APPLICATION_STATUS.DISBURSED;
}

function mapRow(
  r: {
    uuid: string;
    applicationStatus: { name: string };
    details: {
      selectedLoanAmount: Prisma.Decimal | null;
      expectedRepaymentDays: number | null;
      expectedRepaymentDate: Date | null;
      bankAccountNumber: string | null;
      bankName: string | null;
      interestRate: Prisma.Decimal | null;
      processingFeePercentage: Prisma.Decimal | null;
      gstPercentage: Prisma.Decimal | null;
    } | null;
    loanAccount: {
      loanNumber: string;
      principalAmount: Prisma.Decimal;
      interestRate: Prisma.Decimal;
      interestAmount: Prisma.Decimal;
      totalRepaymentAmount: Prisma.Decimal;
      loanMaturityDate: Date;
      disbursedAt: Date;
      closedAt: Date | null;
      waivedAmount: Prisma.Decimal;
      isNocSent: boolean;
      bankAccountNumber: string | null;
      loanStatus: { name: string };
      repayments: Array<{ amount: Prisma.Decimal; status: string }>;
    } | null;
  },
  penal: PenalChargeConfig,
  coolingPeriodDays: number,
): CustomerLoanCard {
  const loanDetail = r.details;
  const loanAccount = r.loanAccount;
  const fees = computeFeeAmountsFromLoanDetail(loanDetail, {
    preferStoredTenure: loanAccount != null,
  });

  const principal =
    decimalToNumber(loanAccount?.principalAmount) ??
    decimalToNumber(loanDetail?.selectedLoanAmount);
  const dailyRate =
    decimalToNumber(loanAccount?.interestRate) ?? decimalToNumber(loanDetail?.interestRate);
  // After disbursement, contracted tenure is disbursedAt → maturity (not the
  // stored expected_repayment_days snapshot, which can be the shorter selection-day count).
  const tenureDays = resolveContractedTenureDays({
    disbursedAt: loanAccount?.disbursedAt,
    maturityDate: loanAccount?.loanMaturityDate,
    expectedRepaymentDate: loanDetail?.expectedRepaymentDate,
    storedDays: fees.tenureDays ?? loanDetail?.expectedRepaymentDays ?? null,
  });

  // Full-tenure interest / amount due on maturity — always from the date-span tenure.
  let interestAtMaturity: number | null = null;
  if (principal != null && dailyRate != null && tenureDays != null) {
    interestAtMaturity = computeInterestAmountInr(principal, dailyRate, tenureDays);
  } else {
    interestAtMaturity =
      fees.interestAmount ??
      (loanAccount != null ? decimalToNumber(loanAccount.interestAmount) : null);
  }

  let amountDueAtMaturity: number | null =
    principal != null && interestAtMaturity != null
      ? Math.round((principal + interestAtMaturity) * 100) / 100
      : decimalToNumber(loanAccount?.totalRepaymentAmount) ?? fees.repaymentAmount;

  // Accrual till today: inclusive days (disbursement day = day 1).
  let daysOutstanding: number | null = null;
  let interestTillToday: number | null = null;
  let amountDueToday: number | null = null;
  let bounceFeeInr: number | null = null;
  let overdueDaysOut: number | null = null;
  let overdueInterestInr: number | null = null;
  let usedFullTenureInterest = false;
  const storedWaiverInr = loanAccount != null ? waivedAmountFromLoan(loanAccount.waivedAmount) : 0;
  let appliedWaiverInr = storedWaiverInr;
  const totalPaid = sumRepaymentAmounts(loanAccount?.repayments ?? []);

  if (loanAccount && loanAccount.closedAt == null && principal != null && dailyRate != null) {
    const pastDue =
      loanAccount.loanStatus.name === LOAN_STATUS.OVERDUE ||
      isRepaymentPastDue(loanAccount.loanMaturityDate);
    const overdueDays = pastDue
      ? Math.max(overdueDaysFromMaturity(loanAccount.loanMaturityDate), 1)
      : 0;
    const due = computeAmountDueNowInr(principal, dailyRate, loanAccount.disbursedAt, {
      coolingPeriodDays,
      tenureDays: tenureDays ?? 1,
      overdueDays,
    });
    daysOutstanding = due.daysOutstanding;
    interestTillToday = due.totalInterestAmount;
    overdueDaysOut = overdueDays;
    overdueInterestInr = due.overdueInterestAmount;
    usedFullTenureInterest = due.usedFullTenureInterest;
    bounceFeeInr = computePenalChargeInr(principal, overdueDays, penal);
    const bill = billDueNowAfterWaiverInr({
      amountDueBeforePenal: due.amountDue,
      penalInr: bounceFeeInr,
      overdueInterestInr: due.overdueInterestAmount,
      waivedAmountInr: storedWaiverInr,
    });
    appliedWaiverInr = bill.appliedWaiverInr;
    amountDueToday = remainingDueInr(bill.billDueNow, totalPaid);
  } else if (loanAccount?.closedAt != null) {
    // Inclusive days from disbursement through repayment (disbursement day = day 1).
    daysOutstanding = calendarDaysBetween(loanAccount.disbursedAt, loanAccount.closedAt) + 1;
    interestTillToday = decimalToNumber(loanAccount.interestAmount);
    amountDueToday = 0;
    bounceFeeInr = null;
  }

  const interestAmountStr = interestAtMaturity != null ? interestAtMaturity.toFixed(2) : null;
  const amountDueAtMaturityStr = amountDueAtMaturity != null ? amountDueAtMaturity.toFixed(2) : null;
  const interestTillTodayStr = interestTillToday != null ? interestTillToday.toFixed(2) : null;
  const amountDueTodayStr = amountDueToday != null ? amountDueToday.toFixed(2) : null;
  const bounceFeeStr = bounceFeeInr != null ? bounceFeeInr.toFixed(2) : null;
  const overdueInterestStr = overdueInterestInr != null ? overdueInterestInr.toFixed(2) : null;

  const displayStatus =
    loanAccount != null
      ? loanAccount.closedAt != null
        ? loanAccount.loanStatus.name === LOAN_STATUS.SETTLED
          ? LOAN_STATUS.SETTLED
          : 'CLOSED'
        : loanAccount.loanStatus.name
      : r.applicationStatus.name;

  return {
    applicationUuid: r.uuid,
    loanNumber: loanAccount?.loanNumber ?? null,
    status: displayStatus,
    loanAmount: principal != null ? principal.toFixed(2) : null,
    // Closed loans: show actual days held; open / in-progress: planned KFS tenure.
    tenureDays:
      loanAccount?.closedAt != null && daysOutstanding != null ? daysOutstanding : tenureDays,
    interestAmount: interestAmountStr,
    amountDueAtMaturity: amountDueAtMaturityStr,
    daysOutstanding,
    interestTillToday: interestTillTodayStr,
    amountDueToday: amountDueTodayStr,
    usedFullTenureInterest,
    overdueDays: overdueDaysOut,
    overdueInterestInr: overdueInterestStr,
    waivedAmountInr: (loanAccount?.closedAt != null ? storedWaiverInr : appliedWaiverInr) > 0.009
      ? (loanAccount?.closedAt != null ? storedWaiverInr : appliedWaiverInr).toFixed(2)
      : null,
    bounceFeeInr: bounceFeeStr,
    totalPaidInr: loanAccount != null ? totalPaid.toFixed(2) : null,
    outstandingInr: amountDueTodayStr,
    processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
    gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
    totalRepayment:
      loanAccount?.closedAt != null
        ? totalPaid > 0.009
          ? totalPaid.toFixed(2)
          : (decimalToNumber(loanAccount.totalRepaymentAmount)?.toFixed(2) ?? amountDueAtMaturityStr)
        : (amountDueTodayStr ?? amountDueAtMaturityStr),
    maturityDate: loanAccount
      ? isoDateOnly(loanAccount.loanMaturityDate)
      : isoDateOnly(loanDetail?.expectedRepaymentDate ?? null),
    disbursedAt: loanAccount ? loanAccount.disbursedAt.toISOString() : null,
    repaidAt: loanAccount?.closedAt ? loanAccount.closedAt.toISOString() : null,
    bankDisplay: maskBank(
      loanDetail?.bankName ?? null,
      loanAccount?.bankAccountNumber ?? loanDetail?.bankAccountNumber ?? null,
    ),
    isNocSent: loanAccount?.isNocSent === true,
  };
}

const APPLICATION_DASHBOARD_SELECT = {
  uuid: true,
  applicationStatus: { select: { name: true } },
  details: {
    select: {
      selectedLoanAmount: true,
      expectedRepaymentDays: true,
      expectedRepaymentDate: true,
      bankAccountNumber: true,
      ifscCode: true,
      bankName: true,
      loanDocumentsAcceptedAt: true,
      interestRate: true,
      processingFeePercentage: true,
      gstPercentage: true,
    },
  },
  loanAccount: {
    select: {
      uuid: true,
      loanNumber: true,
      principalAmount: true,
      interestRate: true,
      interestAmount: true,
      totalRepaymentAmount: true,
      loanMaturityDate: true,
      disbursedAt: true,
      closedAt: true,
      waivedAmount: true,
      isNocSent: true,
      bankAccountNumber: true,
      loanStatus: { select: { name: true } },
      repayments: {
        where: { status: { in: COLLECTED_REPAYMENT_STATUSES } },
        select: { amount: true, status: true },
      },
    },
  },
} as const;

@Injectable()
export class GetCustomerLoansDashboardUseCase {
  private readonly logger = new Logger(GetCustomerLoansDashboardUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly prisma: PrismaService,
    private readonly bounceChargeTiers: BounceChargeTierResolverService,
    private readonly settings: SettingsRepository,
    private readonly redis: RedisService,
    private readonly repaymentSync: LosLoanRepaymentSyncService,
  ) {}

  async execute(req: Request): Promise<CustomerLoansDashboardResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    let rows = await this.prisma.client.application.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: APPLICATION_DASHBOARD_SELECT,
    });

    let reconciledPayment = false;
    let reconciledClosedLoan = false;
    for (const row of rows) {
      const loan = row.loanAccount;
      if (!loan || loan.closedAt != null) continue;
      const pending = await listLoanRepayTxnids(this.redis, loan.uuid);
      if (pending.length === 0) continue;
      try {
        const result = await this.repaymentSync.refreshPayment(loan.uuid, { scope: 'pending' });
        if (result.outcome === 'updated' || result.settled.length > 0) {
          reconciledPayment = true;
          if (result.loanClosed) reconciledClosedLoan = true;
        }
      } catch (error) {
        this.logger.warn(
          `[my-loans] Pending repay sync failed loan=${loan.uuid}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (reconciledPayment) {
      rows = await this.prisma.client.application.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        select: APPLICATION_DASHBOARD_SELECT,
      });
    }

    const penal = await this.bounceChargeTiers.loadPenalConfig();
    const coolingPeriodDays = await this.settings.loadRepayCoolingPeriodDays();
    const minPayAmountInr = await this.settings.loadMinPayAmountInr();
    const todayStart = startOfTodayUtc();
    const liveRepayDate = await resolveRepaymentDueDateUtc(this.prisma.client);
    const cards = rows.map((row) =>
      mapRow(
        row.loanAccount
          ? row
          : {
              ...row,
              details: overlayLiveRepaymentDueDateIfSelected(row.details, liveRepayDate) ?? row.details,
            },
        penal,
        coolingPeriodDays,
      ),
    );

    const maturityFor = (raw: (typeof rows)[number]) =>
      raw.loanAccount?.loanMaturityDate ?? raw.details?.expectedRepaymentDate ?? null;

    const disbursedAtFor = (raw: (typeof rows)[number]) => raw.loanAccount?.disbursedAt ?? null;

    const isOpenLoanAccount = (raw: (typeof rows)[number]): boolean =>
      Boolean(raw.loanAccount && raw.loanAccount.closedAt == null);

    /** Open disbursed loan — still active even when repayment is overdue. */
    const isActiveRow = (raw: (typeof rows)[number]): boolean => {
      if (isTerminalApplicationStatus(raw.applicationStatus.name, raw.details?.loanDocumentsAcceptedAt)) return false;
      if (!isOpenLoanAccount(raw)) return false;
      return isDisbursedRow(disbursedAtFor(raw), raw.applicationStatus.name);
    };

    /** Closed / rejected applications only — overdue open loans stay in active. */
    const isPastRow = (raw: (typeof rows)[number]): boolean => {
      if (isTerminalApplicationStatus(raw.applicationStatus.name, raw.details?.loanDocumentsAcceptedAt)) return true;
      return raw.loanAccount?.closedAt != null;
    };

    const activeIndices = rows
      .map((raw, i) => ({ raw, i }))
      .filter(({ raw }) => isActiveRow(raw))
      .sort((a, b) => {
        const da = disbursedAtFor(a.raw)?.getTime() ?? 0;
        const db = disbursedAtFor(b.raw)?.getTime() ?? 0;
        return db - da;
      })
      .map(({ i }) => i);

    const activeLoans = activeIndices.map((i) => cards[i]);

    const pastLoans = cards.filter((_, i) => isPastRow(rows[i]));

    const inProgress = cards.filter((_, i) => {
      const raw = rows[i];
      if (raw.details?.selectedLoanAmount == null) return false;
      if (isActiveRow(raw)) return false;
      if (isPastRow(raw)) return false;
      return true;
    });

    const repaymentSchedule: CustomerLoanRepaymentLine[] = [];
    for (const i of activeIndices) {
      const card = cards[i];
      const raw = rows[i];
      const maturity = maturityFor(raw);
      const total = card.amountDueAtMaturity ?? card.totalRepayment;
      if (maturity && total) {
        const maturityStart = new Date(
          Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate())
        );
        let lineStatus: CustomerLoanRepaymentLine['status'] = 'scheduled';
        if (maturityStart < todayStart) lineStatus = 'overdue';
        else if (maturityStart.getTime() === todayStart.getTime()) lineStatus = 'due';
        const suffix = activeLoans.length > 1 ? ` · ${card.loanNumber ?? card.applicationUuid.slice(0, 8)}…` : '';
        const overdueBits =
          card.overdueDays != null && card.overdueDays > 0
            ? ' + overdue interest + penal'
            : '';
        repaymentSchedule.push({
          dueDate: isoDateOnly(maturity) ?? '',
          label: `${card.totalPaidInr != null && Number(card.totalPaidInr) > 0 ? 'Remaining repayment' : 'Full repayment'} (principal + interest${overdueBits})${suffix}`,
          amount: card.amountDueToday ?? total,
          status: lineStatus,
        });
      }
    }

    return {
      activeLoans,
      pastLoans,
      inProgress,
      repaymentSchedule,
      minPayAmountInr: minPayAmountInr.toFixed(2),
      reconciledPayment,
      reconciledClosedLoan,
    };
  }
}
