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

/** Daily ROI % × principal × tenure days. */
export function computeInterestAmountInr(
  selectedLoanAmount: number,
  interestRatePercentagePerDay: number,
  tenureDays: number,
): number {
  return selectedLoanAmount * (interestRatePercentagePerDay / 100) * tenureDays;
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
