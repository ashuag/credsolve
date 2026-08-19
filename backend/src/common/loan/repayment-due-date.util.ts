import { istCalendarDateUtc } from './loan-calculation.util';

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
