import { decimalToNumber, type DecimalLike } from './loan-calculation.util';
import { roundInr2 } from './loan-repayment-outstanding.util';

/** Penal + overdue-days interest — the only charges that can be waived. */
export function negotiableOverdueChargesInr(penalInr: number, overdueInterestInr: number): number {
  return roundInr2(Math.max(0, penalInr) + Math.max(0, overdueInterestInr));
}

export function appliedChargeWaiverInr(
  negotiableInr: number,
  waivedAmountInr: number | null | undefined,
): number {
  const negotiable = Math.max(0, roundInr2(negotiableInr));
  const waived = Math.max(0, roundInr2(waivedAmountInr ?? 0));
  return Math.min(waived, negotiable);
}

/**
 * Live bill after a LOS waiver of penal + overdue-days interest.
 * `amountDueBeforePenal` is principal + tenure interest + overdue-days interest.
 */
export function billDueNowAfterWaiverInr(input: {
  amountDueBeforePenal: number;
  penalInr: number;
  overdueInterestInr: number;
  waivedAmountInr: number | null | undefined;
}): {
  negotiableInr: number;
  appliedWaiverInr: number;
  remainingNegotiableInr: number;
  billDueNow: number;
} {
  const negotiableInr = negotiableOverdueChargesInr(input.penalInr, input.overdueInterestInr);
  const appliedWaiverInr = appliedChargeWaiverInr(negotiableInr, input.waivedAmountInr);
  const remainingNegotiableInr = roundInr2(negotiableInr - appliedWaiverInr);
  return {
    negotiableInr,
    appliedWaiverInr,
    remainingNegotiableInr,
    billDueNow: roundInr2(input.amountDueBeforePenal + input.penalInr - appliedWaiverInr),
  };
}

export function waivedAmountFromLoan(value: DecimalLike): number {
  return decimalToNumber(value) ?? 0;
}
