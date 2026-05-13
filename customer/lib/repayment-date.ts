/** Calendar last day of month `monthIndex` (0 = January) in local time. */
export function lastDayOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

/**
 * Fixed repayment (maturity) date:
 * - Day 1–15 → last day of the **current** month.
 * - Day 16 onward → last day of the **next** month.
 */
export function computeFixedRepaymentDate(from: Date = new Date()): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const d = from.getDate();
  if (d <= 15) {
    return lastDayOfMonth(y, m);
  }
  return lastDayOfMonth(y, m + 1);
}
