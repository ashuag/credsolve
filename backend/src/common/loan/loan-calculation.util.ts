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

/** Bullet amount due now: principal + interest accrued till `asOf` (fees taken at disbursement). */
export function computeAmountDueNowInr(
  principal: number,
  interestRatePercentagePerDay: number,
  disbursedAt: Date,
  asOf: Date = new Date(),
): { daysOutstanding: number; interestAmount: number; amountDue: number } {
  const accrued = computeAccruedInterestInr(
    principal,
    interestRatePercentagePerDay,
    disbursedAt,
    asOf,
  );
  return {
    ...accrued,
    amountDue: roundInr2(principal + accrued.interestAmount),
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
  processingFeeAmount: number,
  gstAmount: number,
): number {
  return selectedLoanAmount + interestAmount + processingFeeAmount + gstAmount;
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
