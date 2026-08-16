/** Calendar last day of month `monthIndex` (0 = January) in local time. */
export function lastDayOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

/** Parse YYYY-MM-DD as a local calendar date. */
export function parseIsoDateLocal(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Fixed repayment (maturity) date:
 * - Day 1–15 → last day of the **current** month.
 * - Day 16 onward → last day of the **next** month.
 * Prefer `overrideIso` from `/loans/settings` when present (LOS month override).
 */
export function computeFixedRepaymentDate(from: Date = new Date(), overrideIso?: string | null): Date {
  if (overrideIso) {
    const parsed = parseIsoDateLocal(overrideIso);
    if (parsed) return parsed;
  }
  const y = from.getFullYear();
  const m = from.getMonth();
  const d = from.getDate();
  if (d <= 15) {
    return lastDayOfMonth(y, m);
  }
  return lastDayOfMonth(y, m + 1);
}
