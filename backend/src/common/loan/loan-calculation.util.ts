import type { Prisma } from '@prisma/client';

export type DecimalLike =
  | Prisma.Decimal
  | { toNumber(): number }
  | { toString(): string }
  | null
  | undefined;

export function decimalToNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  if (typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    const n = (value as { toNumber(): number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/** UTC calendar-day difference (maturity / accrual day count). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/** Calendar date in Asia/Kolkata as a UTC midnight `Date` (for DATE / day-count math). */
export function istCalendarDateUtc(at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Inclusive tenure day count (disbursement / selection day = day 1).
 * e.g. 29 Jul → 31 Aug = 34 days; 13 Jul → 31 Jul = 19 days.
 */
export function computeTenureDays(from: Date, to: Date): number {
  return Math.max(1, calendarDaysBetween(from, to) + 1);
}

/**
 * Live tenure from `asOf` (IST calendar day) through the expected repay date.
 * Falls back to a stored day count when no repay date is available.
 */
export function resolveLiveTenureDays(
  expectedRepaymentDate: Date | null | undefined,
  asOf: Date = new Date(),
  fallbackStored?: number | null,
): number | null {
  if (expectedRepaymentDate) {
    return computeTenureDays(istCalendarDateUtc(asOf), expectedRepaymentDate);
  }
  return fallbackStored ?? null;
}

/**
 * Contracted bullet tenure. Days are never an independent input — they come from dates.
 * After disbursement: inclusive calendar days from disbursement through maturity
 * (same formula as pay-now / cooling-period full tenure).
 * Before disbursement: IST today through the expected repay date (live, not the
 * selection-day snapshot in `expected_repayment_days`).
 */
export function resolveContractedTenureDays(input: {
  disbursedAt?: Date | null;
  maturityDate?: Date | null;
  expectedRepaymentDate?: Date | null;
  storedDays?: number | null;
  asOf?: Date;
}): number | null {
  if (input.disbursedAt != null && input.maturityDate != null) {
    return computeTenureDays(input.disbursedAt, input.maturityDate);
  }
  return resolveLiveTenureDays(
    input.expectedRepaymentDate,
    input.asOf ?? new Date(),
    input.storedDays,
  );
}

function roundInr2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Interest for planned tenure (selection / KFS estimate).
 * Stored ROI is % per day (= annualRate% / 365).
 * interest = principal × (dailyRate% / 100) × days
 *         = principal × (annualRate% / 100 / 365) × days
 */
export function computeInterestAmountInr(
  selectedLoanAmount: number,
  interestRatePercentagePerDay: number,
  tenureDays: number,
): number {
  return roundInr2(selectedLoanAmount * (interestRatePercentagePerDay / 100) * tenureDays);
}

/**
 * Accrued interest from disbursement through `asOf` (inclusive day count).
 * Disbursement day = day 1, so same-day repayment still attracts 1 day of interest.
 * Matches tenure counting (e.g. 13 Jul → 31 Jul = 19 days).
 */
export function computeAccruedInterestInr(
  principal: number,
  interestRatePercentagePerDay: number,
  disbursedAt: Date,
  asOf: Date = new Date(),
): { daysOutstanding: number; interestAmount: number } {
  const daysOutstanding = calendarDaysBetween(disbursedAt, asOf) + 1;
  const interestAmount = computeInterestAmountInr(
    principal,
    interestRatePercentagePerDay,
    daysOutstanding,
  );
  return { daysOutstanding, interestAmount };
}

/** Bullet amount due now: principal + interest (fees taken at disbursement).
 *
 * Interest days:
 * - within `coolingPeriodDays` (inclusive, disbursement day = day 1): days outstanding
 * - after the cooling period: full contracted `tenureDays`
 *
 * `coolingPeriodDays = 0` means no concession (always full tenure).
 */
export function computeAmountDueNowInr(
  principal: number,
  interestRatePercentagePerDay: number,
  disbursedAt: Date,
  options: {
    asOf?: Date;
    coolingPeriodDays: number;
    tenureDays: number;
  },
): {
  daysOutstanding: number;
  interestDays: number;
  interestAmount: number;
  amountDue: number;
  usedFullTenureInterest: boolean;
} {
  const asOf = options.asOf ?? new Date();
  const daysOutstanding = Math.max(1, calendarDaysBetween(disbursedAt, asOf) + 1);
  const cooling = Math.max(0, Math.floor(options.coolingPeriodDays));
  const tenure = Math.max(1, Math.floor(options.tenureDays));
  const usedFullTenureInterest = !(cooling > 0 && daysOutstanding <= cooling);
  const interestDays = usedFullTenureInterest ? tenure : daysOutstanding;
  const interestAmount = computeInterestAmountInr(
    principal,
    interestRatePercentagePerDay,
    interestDays,
  );
  return {
    daysOutstanding,
    interestDays,
    interestAmount,
    amountDue: roundInr2(principal + interestAmount),
    usedFullTenureInterest,
  };
}

export function computeDisburseAmountInr(
  selectedLoanAmount: number,
  processingFeeAmount: number,
  gstAmount: number,
): number {
  return selectedLoanAmount - processingFeeAmount - gstAmount;
}

export function computeRepaymentAmountInr(
  selectedLoanAmount: number,
  interestAmount: number,
): number {
  return selectedLoanAmount + interestAmount;
}

export function computeInterestAmountFromLoanDetail(
  loanDetail: {
    selectedLoanAmount: DecimalLike;
    interestRate: DecimalLike;
  } | null | undefined,
  tenureDays: number | null | undefined,
): number | null {
  const principal = decimalToNumber(loanDetail?.selectedLoanAmount);
  const roi = decimalToNumber(loanDetail?.interestRate);
  if (principal == null || roi == null || tenureDays == null) return null;
  return computeInterestAmountInr(principal, roi, tenureDays);
}

export function sumDecimalAmounts(parts: Array<DecimalLike>): string | null {
  let total = 0;
  let any = false;
  for (const part of parts) {
    const n = decimalToNumber(part);
    if (n == null) continue;
    any = true;
    total += n;
  }
  if (!any) return null;
  return total.toFixed(2);
}
