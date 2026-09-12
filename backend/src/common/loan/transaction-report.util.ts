import { overdueDaysFromMaturity } from './bounce-charge.util';
import { computeAmountDueNowInr, computeTenureDays } from './loan-calculation.util';

export type TransactionReportMetrics = {
  /** Interest charged through repayment; 0 until a repayment is recorded. */
  interestReceived: number;
  /** IST calendar days past due as of repayment (or `asOf` if unpaid). */
  daysExceeded: number;
};

/**
 * Interest collected and days past due for the LOS transaction report.
 * Unpaid loans contribute 0 interest received; delay is measured through `asOf`.
 */
export function resolveTransactionReportMetrics(input: {
  disbursedAt: Date;
  dueDate: Date;
  principal: number | null;
  interestRatePerDay: number | null;
  repaymentAt: Date | null;
  asOf?: Date;
  coolingPeriodDays: number;
}): TransactionReportMetrics {
  const delayAsOf = input.repaymentAt ?? input.asOf ?? new Date();
  const daysExceeded = overdueDaysFromMaturity(input.dueDate, delayAsOf);

  if (
    input.repaymentAt == null ||
    input.principal == null ||
    input.interestRatePerDay == null
  ) {
    return { interestReceived: 0, daysExceeded };
  }

  const { totalInterestAmount } = computeAmountDueNowInr(
    input.principal,
    input.interestRatePerDay,
    input.disbursedAt,
    {
      asOf: input.repaymentAt,
      coolingPeriodDays: input.coolingPeriodDays,
      tenureDays: computeTenureDays(input.disbursedAt, input.dueDate),
      overdueDays: daysExceeded,
    },
  );
  return { interestReceived: totalInterestAmount, daysExceeded };
}
