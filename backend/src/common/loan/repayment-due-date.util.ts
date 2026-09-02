import type { Prisma } from '@prisma/client';
import { computeTenureDays, istCalendarDateUtc } from './loan-calculation.util';

export function isoDateOnlyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDateUtc(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** Last calendar day of `month` (1–12) as a UTC midnight Date. */
export function lastDayOfMonthUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

/**
 * Default repayment due date (month-end):
 * - IST day 1–15 → last day of the current month
 * - IST day 16+ → last day of the next month
 */
export function defaultMonthEndDueDateUtc(todayIstUtcMidnight: Date): Date {
  const year = todayIstUtcMidnight.getUTCFullYear();
  const monthIndex = todayIstUtcMidnight.getUTCMonth();
  const day = todayIstUtcMidnight.getUTCDate();
  if (day <= 15) {
    return lastDayOfMonthUtc(year, monthIndex + 1);
  }
  return lastDayOfMonthUtc(year, monthIndex + 2);
}

export type RepaymentDueDateOverrideRow = {
  dueDate: Date;
};

export type RepaymentDueDateLookup = {
  repaymentDueDate: {
    findFirst: (args: {
      where: { year: number; month: number; isActive: boolean };
      select: { dueDate: true };
    }) => Promise<RepaymentDueDateOverrideRow | null>;
  };
};

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function loadActiveOverride(
  prisma: RepaymentDueDateLookup,
  year: number,
  month: number,
): Promise<Date | null> {
  const override = await prisma.repaymentDueDate.findFirst({
    where: { year, month, isActive: true },
    select: { dueDate: true },
  });
  if (!override) return null;
  return utcMidnight(override.dueDate);
}

/**
 * Repayment due date:
 * 1. If this calendar month has an active override and that date is still on/after today, use it
 *    (so 20 Aug with a 10 Sep override stays 10 Sep instead of rolling to month-end).
 * 2. Else month-end rule (1–15 this month / 16+ next month), then apply that month's override if still on/after today.
 */
export async function resolveRepaymentDueDateUtc(
  prisma: RepaymentDueDateLookup,
  asOf: Date = new Date(),
): Promise<Date> {
  const today = istCalendarDateUtc(asOf);
  const currentMonthOverride = await loadActiveOverride(
    prisma,
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
  );
  if (currentMonthOverride && currentMonthOverride.getTime() >= today.getTime()) {
    return currentMonthOverride;
  }

  const fallback = defaultMonthEndDueDateUtc(today);
  const dueMonthOverride = await loadActiveOverride(
    prisma,
    fallback.getUTCFullYear(),
    fallback.getUTCMonth() + 1,
  );
  if (dueMonthOverride && dueMonthOverride.getTime() >= today.getTime()) {
    return dueMonthOverride;
  }
  return fallback;
}

export type ExpectedRepaymentSyncClient = Pick<
  Prisma.TransactionClient,
  'repaymentDueDate' | 'applicationDetail'
>;

export type LoanDetailWithExpectedRepayment = {
  expectedRepaymentDate?: Date | null;
  expectedRepaymentDays?: number | null;
};

/**
 * Replace a pre-disbursement snapshot with the currently resolved due date
 * (and live tenure from `asOf`). No-op when there is no stored selection date.
 */
export function overlayLiveRepaymentDueDate<T extends LoanDetailWithExpectedRepayment>(
  loanDetail: T,
  liveDate: Date,
  asOf: Date = new Date(),
): T {
  return {
    ...loanDetail,
    expectedRepaymentDate: liveDate,
    expectedRepaymentDays: computeTenureDays(istCalendarDateUtc(asOf), liveDate),
  };
}

export function overlayLiveRepaymentDueDateIfSelected<T extends LoanDetailWithExpectedRepayment>(
  loanDetail: T | null | undefined,
  liveDate: Date | null | undefined,
  asOf: Date = new Date(),
): T | null | undefined {
  if (!loanDetail || !liveDate || loanDetail.expectedRepaymentDate == null) {
    return loanDetail;
  }
  return overlayLiveRepaymentDueDate(loanDetail, liveDate, asOf);
}

export type SyncedExpectedRepayment = {
  expectedRepaymentDate: Date | null;
  expectedRepaymentDays: number | null;
  changed: boolean;
};

/**
 * Recalculate `application_detail.expected_repayment_date` from today's rule
 * (month-end + LOS override) until a loan account exists. After disbursement the
 * date is frozen on `loan_account.loan_maturity_date`.
 *
 * When the date changes and documents are not yet accepted, unsigned KFS files
 * and the review stamp are cleared so the customer re-reviews the new date.
 */
export async function syncExpectedRepaymentDateUntilDisbursed(
  prisma: ExpectedRepaymentSyncClient,
  params: {
    applicationId: bigint;
    storedDate: Date | null | undefined;
    storedDays?: number | null;
    disbursed: boolean;
    invalidateUnsignedDocuments?: boolean;
    asOf?: Date;
  },
): Promise<SyncedExpectedRepayment> {
  if (params.disbursed) {
    return {
      expectedRepaymentDate: params.storedDate ?? null,
      expectedRepaymentDays: params.storedDays ?? null,
      changed: false,
    };
  }
  if (params.storedDate == null) {
    return {
      expectedRepaymentDate: null,
      expectedRepaymentDays: params.storedDays ?? null,
      changed: false,
    };
  }

  const liveDate = await resolveRepaymentDueDateUtc(prisma, params.asOf);
  const liveDays = computeTenureDays(istCalendarDateUtc(params.asOf), liveDate);
  const changed = isoDateOnlyUtc(params.storedDate) !== isoDateOnlyUtc(liveDate);
  if (changed) {
    await prisma.applicationDetail.update({
      where: { applicationId: params.applicationId },
      data: {
        expectedRepaymentDate: liveDate,
        expectedRepaymentDays: liveDays,
        ...(params.invalidateUnsignedDocuments
          ? {
              keyFactPdfRelativePath: null,
              loanAgreementPdfRelativePath: null,
              keyFactEsigned: false,
              loanDocumentsReviewedAt: null,
              loanDocumentsReviewedIp: null,
            }
          : {}),
      },
    });
  }

  return {
    expectedRepaymentDate: liveDate,
    expectedRepaymentDays: liveDays,
    changed,
  };
}
