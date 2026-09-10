import type { Prisma, PrismaClient } from '@prisma/client';
import { LOAN_REPAYMENT_STATUS, isCollectedRepaymentStatus } from '../constants/loan-repayment.constants';

const PAISA = 100;
const CLOSE_TOLERANCE_INR = 0.01;

export function roundInr2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function inrToPaise(n: number): number {
  return Math.round(roundInr2(n) * PAISA);
}

export function amountsMatchInrNumber(a: number, b: number, tolerancePaise = 1): boolean {
  return Math.abs(inrToPaise(a) - inrToPaise(b)) <= tolerancePaise;
}

export function remainingDueInr(billDueNowInr: number, totalPaidInr: number): number {
  return Math.max(0, roundInr2(billDueNowInr - totalPaidInr));
}

export function shouldCloseLoanAfterPayment(remainingAfterInr: number): boolean {
  return remainingAfterInr <= CLOSE_TOLERANCE_INR;
}

export function sumRepaymentAmounts(
  rows: Array<{ amount: unknown; status?: string | null }>,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.status != null && !isCollectedRepaymentStatus(row.status)) continue;
    const n = typeof row.amount === 'number' ? row.amount : Number(row.amount);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return roundInr2(total);
}

export type ResolvedPayAmount = {
  amountInr: number;
  isFullPayoff: boolean;
};

/**
 * Full payoff (omit amount, or amount equals remaining) is always allowed.
 * Partial must be ≥ min (unless remaining itself is below min — then only full remaining is allowed)
 * and strictly less than remaining.
 */
export function resolveRequestedPayAmount(input: {
  requestedAmountInr: number | null | undefined;
  remainingInr: number;
  minPayAmountInr: number;
}): ResolvedPayAmount | { error: string } {
  const remaining = roundInr2(input.remainingInr);
  if (!(remaining > 0)) {
    return { error: 'Nothing due on this loan right now.' };
  }

  const requestedRaw = input.requestedAmountInr;
  if (requestedRaw == null || !Number.isFinite(requestedRaw)) {
    return { amountInr: remaining, isFullPayoff: true };
  }

  const requested = roundInr2(requestedRaw);
  if (!(requested > 0)) {
    return { error: 'Enter an amount greater than zero.' };
  }
  if (requested > remaining && !amountsMatchInrNumber(requested, remaining)) {
    return { error: `Amount cannot exceed the remaining balance of ₹${remaining.toFixed(2)}.` };
  }
  if (amountsMatchInrNumber(requested, remaining)) {
    return { amountInr: remaining, isFullPayoff: true };
  }

  const minPay = Math.max(0, roundInr2(input.minPayAmountInr));
  if (remaining < minPay || amountsMatchInrNumber(remaining, minPay)) {
    return {
      error: `Remaining balance is ₹${remaining.toFixed(2)}. Pay the full remaining amount.`,
    };
  }
  if (requested < minPay && !amountsMatchInrNumber(requested, minPay)) {
    return { error: `Minimum partial payment is ₹${minPay.toFixed(2)}.` };
  }

  return { amountInr: requested, isFullPayoff: false };
}

export async function sumSuccessfulRepaymentsInr(
  db: PrismaClient | Prisma.TransactionClient,
  loanAccountId: bigint,
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ total: unknown }>>`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM loan_repayment
    WHERE loan_account_id = ${loanAccountId}
      AND status IN (${LOAN_REPAYMENT_STATUS.SUCCESS}, ${LOAN_REPAYMENT_STATUS.PARTIAL})
  `;
  return roundInr2(Number(rows[0]?.total ?? 0));
}
