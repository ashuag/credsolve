/** IST wall-clock helpers for LOS datetime-range filters. */

export const IST_TIME_ZONE = 'Asia/Kolkata';

export type DatetimeRangeValue = {
  fromYmd: string;
  fromHm: string;
  toYmd: string;
  toHm: string;
};

export type DatetimeRangePresetId =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last7Days'
  | 'last30Days';

export const DATETIME_RANGE_PRESETS: Array<{ id: DatetimeRangePresetId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'last7Days', label: 'Last 7 days' },
  { id: 'last30Days', label: 'Last 30 days' },
];

type IstDateParts = { year: number; month: number; day: number };

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function istYmd(parts: IstDateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function parseYmd(ymd: string): IstDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function getIstParts(date: Date = new Date()): IstDateParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function addIstDays(ymd: string, days: number): string {
  const ms = new Date(`${ymd}T12:00:00+05:30`).getTime() + days * 86_400_000;
  return istYmd(getIstParts(new Date(ms)));
}

function istWeekdayMondayIndex(ymd: string): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
  }).format(new Date(`${ymd}T12:00:00+05:30`));
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[label] ?? 0;
}

function startOfIstWeek(ymd: string): string {
  return addIstDays(ymd, -istWeekdayMondayIndex(ymd));
}

function lastDayOfIstMonth(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return addIstDays(`${nextYear}-${pad2(nextMonth)}-01`, -1);
}

function range(fromYmd: string, toYmd: string, fromHm = '00:00', toHm = '23:59'): DatetimeRangeValue {
  return { fromYmd, fromHm, toYmd, toHm };
}

export function datetimeRangeFromPreset(
  id: DatetimeRangePresetId,
  now: Date = new Date(),
): DatetimeRangeValue {
  const today = istYmd(getIstParts(now));
  const todayParts = getIstParts(now);

  switch (id) {
    case 'today':
      return range(today, today);
    case 'yesterday': {
      const yesterday = addIstDays(today, -1);
      return range(yesterday, yesterday);
    }
    case 'thisWeek': {
      const start = startOfIstWeek(today);
      return range(start, addIstDays(start, 6));
    }
    case 'lastWeek': {
      const thisStart = startOfIstWeek(today);
      const lastStart = addIstDays(thisStart, -7);
      return range(lastStart, addIstDays(lastStart, 6));
    }
    case 'thisMonth':
      return range(
        `${todayParts.year}-${pad2(todayParts.month)}-01`,
        lastDayOfIstMonth(todayParts.year, todayParts.month),
      );
    case 'lastMonth': {
      const month = todayParts.month === 1 ? 12 : todayParts.month - 1;
      const year = todayParts.month === 1 ? todayParts.year - 1 : todayParts.year;
      return range(`${year}-${pad2(month)}-01`, lastDayOfIstMonth(year, month));
    }
    case 'last7Days':
      return range(addIstDays(today, -6), today);
    case 'last30Days':
      return range(addIstDays(today, -29), today);
  }
}

export function serializeDatetimeRange(value: DatetimeRangeValue): string {
  return `${value.fromYmd}T${value.fromHm}|${value.toYmd}T${value.toHm}`;
}

export function parseDatetimeRange(raw: string | null | undefined): DatetimeRangeValue | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})(?::\d{2})?\|(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const parsed = {
    fromYmd: match[1]!,
    fromHm: normalizeHm(match[2]!, '00:00'),
    toYmd: match[3]!,
    toHm: normalizeHm(match[4]!, '23:59'),
  };
  if (!parseYmd(parsed.fromYmd) || !parseYmd(parsed.toYmd)) return null;
  return parsed;
}

export function normalizeHm(raw: string, fallback = '00:00'): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${pad2(hour)}:${pad2(minute)}`;
}

function rangeStartMs(value: DatetimeRangeValue): number {
  return new Date(`${value.fromYmd}T${value.fromHm}:00.000+05:30`).getTime();
}

function rangeEndMs(value: DatetimeRangeValue): number {
  return new Date(`${value.toYmd}T${value.toHm}:59.999+05:30`).getTime();
}

export function normalizeDatetimeRange(value: DatetimeRangeValue): DatetimeRangeValue {
  const start = rangeStartMs(value);
  const end = rangeEndMs(value);
  if (Number.isNaN(start) || Number.isNaN(end) || start <= end) return value;
  return {
    fromYmd: value.toYmd,
    fromHm: value.toHm,
    toYmd: value.fromYmd,
    toHm: value.fromHm,
  };
}

export function matchesDatetimeRange(iso: string | number | null | undefined, filterValue: string): boolean {
  const rangeValue = parseDatetimeRange(filterValue);
  if (!rangeValue) return true;
  if (iso == null || iso === '') return false;
  const ts = typeof iso === 'number' ? iso : new Date(String(iso)).getTime();
  if (Number.isNaN(ts)) return false;
  const normalized = normalizeDatetimeRange(rangeValue);
  return ts >= rangeStartMs(normalized) && ts <= rangeEndMs(normalized);
}

export function matchingDatetimeRangePreset(
  value: DatetimeRangeValue,
  now: Date = new Date(),
): DatetimeRangePresetId | null {
  const serialized = serializeDatetimeRange(normalizeDatetimeRange(value));
  for (const preset of DATETIME_RANGE_PRESETS) {
    if (serializeDatetimeRange(datetimeRangeFromPreset(preset.id, now)) === serialized) {
      return preset.id;
    }
  }
  return null;
}

export function formatDatetimeRangeLabel(value: DatetimeRangeValue, now: Date = new Date()): string {
  const presetId = matchingDatetimeRangePreset(value, now);
  if (presetId) {
    return DATETIME_RANGE_PRESETS.find((preset) => preset.id === presetId)?.label ?? 'Custom';
  }

  const fromDate = formatYmdShort(value.fromYmd);
  const toDate = formatYmdShort(value.toYmd);
  const showTime = value.fromHm !== '00:00' || value.toHm !== '23:59';
  if (value.fromYmd === value.toYmd) {
    return showTime ? `${fromDate} ${value.fromHm}–${value.toHm}` : fromDate;
  }
  return showTime ? `${fromDate} ${value.fromHm} – ${toDate} ${value.toHm}` : `${fromDate} – ${toDate}`;
}

export function formatYmdShort(ymd: string): string {
  const parts = parseYmd(ymd);
  if (!parts) return ymd;
  return new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
  });
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(`${year}-${pad2(month)}-01T12:00:00+05:30`).toLocaleDateString('en-IN', {
    timeZone: IST_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const next = month - 1 + delta;
  const y = year + Math.floor(next / 12);
  const m = ((next % 12) + 12) % 12;
  return { year: y, month: m + 1 };
}

export function monthGrid(year: number, month: number): Array<{ ymd: string } | null> {
  const first = `${year}-${pad2(month)}-01`;
  const lead = istWeekdayMondayIndex(first);
  const last = lastDayOfIstMonth(year, month);
  const lastParts = parseYmd(last);
  const days = lastParts?.day ?? 30;
  const cells: Array<{ ymd: string } | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) {
    cells.push({ ymd: `${year}-${pad2(month)}-${pad2(day)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
