export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const MIN_DOB_YEAR = 1950;

/** Formats a partial digit string into DD/MM/YYYY as the user types. */
export function formatDobInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parses a DD/MM/YYYY string into a Date, returning null if invalid. */
export function parseDobDisplay(value: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split('/').map(Number);
  if (year < MIN_DOB_YEAR) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Parses a YYYY-MM-DD ISO date string into a Date, returning null if invalid. */
export function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Formats a Date as DD/MM/YYYY for display. */
export function formatDateDisplay(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Formats a Date as YYYY-MM-DD for API/storage. */
export function formatDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Calculates age from a YYYY-MM-DD DOB string. Returns NaN if invalid. */
export function getAge(isoDate: string): number {
  const birth = parseIsoDate(isoDate);
  if (!birth) return Number.NaN;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Returns the first day of the month for the given date. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Generates a 6-week (42-day) calendar grid for the given month. */
export function getCalendarDays(month: Date): Array<{ date: Date; isCurrentMonth: boolean }> {
  const firstDay = startOfMonth(month);
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date, isCurrentMonth: date.getMonth() === month.getMonth() };
  });
}

/** Returns a Date set to 25 years before today, start of month. */
export function defaultDobMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear() - 25, now.getMonth(), 1);
}
