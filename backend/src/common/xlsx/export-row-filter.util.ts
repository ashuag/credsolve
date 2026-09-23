import { BadRequestException } from '@nestjs/common';

/**
 * Filter matchers mirroring the LOS `DataTable` frontend's column filter semantics
 * (`los/components/ui/data-table.tsx` `defaultColumnMatches`, `los/lib/number-range.ts`,
 * `los/lib/multi-select.ts`, `los/lib/datetime-range.ts`) — for report-style dumps (lead reports,
 * transaction reports, …) whose "columns" are mostly derived labels computed in JS rather than
 * stored DB columns, so the export filters the already-mapped in-memory rows post-fetch instead of
 * building a Prisma `where`. Keeping the matching rules identical to the frontend's guarantees the
 * exported rows are exactly the rows the user sees filtered on screen.
 */

export const EXPORT_EMPTY_FILTER_VALUE = '__none__';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function matchesExportTextFilter(
  actual: string | number | null | undefined,
  filterValue: string,
): boolean {
  return String(actual ?? '')
    .toLowerCase()
    .includes(filterValue.toLowerCase());
}

export function matchesExportSelectFilter(
  actual: string | number | null | undefined,
  filterValue: string,
): boolean {
  return String(actual ?? '').toLowerCase() === filterValue.toLowerCase();
}

/** `filterValue` is a comma-separated list (`los/lib/multi-select.ts` `serializeMultiSelect`). */
export function matchesExportMultiSelectFilter(
  actual: string | null | undefined,
  filterValue: string,
  emptyValue: string = EXPORT_EMPTY_FILTER_VALUE,
): boolean {
  const selected = [...new Set(filterValue.split(',').map((v) => v.trim()).filter(Boolean))];
  if (selected.length === 0) return true;
  const trimmed = actual?.trim();
  const haystack = !trimmed || trimmed === 'NOT_APPLICABLE' ? emptyValue : trimmed;
  return selected.some((value) => value.toLowerCase() === haystack.toLowerCase());
}

export function matchesExportNumberFilter(
  actual: number | string | null | undefined,
  filterValue: string,
): boolean {
  const target = Number(filterValue);
  if (!Number.isFinite(target)) return true;
  const n = typeof actual === 'number' ? actual : Number(actual);
  return Number.isFinite(n) && n === target;
}

/** Exact calendar-day match against a `YYYY-MM-DD` filter value (no timezone conversion — the stored value is a date, not an instant). */
export function matchesExportDateFilter(
  actual: string | null | undefined,
  filterValue: string,
): boolean {
  const day = actual?.trim().slice(0, 10);
  return Boolean(day) && day === filterValue;
}

/** Parses a `YYYY-MM-DD` filter value into a UTC-midnight `Date` — for exact matches against a `@db.Date` column. */
export function parseExportDateOnly(value: string | undefined, field: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
  }
  const [y, m, d] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date.`);
  }
  return date;
}

/** UTC instant range covering the IST calendar day named by a `YYYY-MM-DD` filter value — for a `@db.DateTime` column (e.g. `createdAt`). */
export function parseExportIstDayRange(
  value: string | undefined,
  field: string,
): { start: Date; end: Date } | undefined {
  const dayUtc = parseExportDateOnly(value, field);
  if (!dayUtc) return undefined;
  const start = new Date(dayUtc.getTime() - IST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Parses the `min|max` format `los/lib/number-range.ts` `serializeNumberRange` produces (either side optional). */
export function parseExportNumberRange(
  raw: string | undefined,
  field: string,
): { min: number | null; max: number | null } | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const match = /^(-?\d+(?:\.\d+)?)?\|(-?\d+(?:\.\d+)?)?$/.exec(trimmed);
  if (!match) {
    throw new BadRequestException(`${field} must be a "min|max" range.`);
  }
  const min = match[1] ? Number(match[1]) : null;
  const max = match[2] ? Number(match[2]) : null;
  if (min == null && max == null) {
    throw new BadRequestException(`${field} must be a "min|max" range.`);
  }
  return { min, max };
}

export function matchesExportNumberRangeFilter(
  actual: number | string | null | undefined,
  filterValue: string,
  field: string,
): boolean {
  const range = parseExportNumberRange(filterValue, field);
  if (!range) return true;
  if (actual == null || actual === '') return false;
  const n = typeof actual === 'number' ? actual : Number(actual);
  if (!Number.isFinite(n)) return false;
  let { min, max } = range;
  if (min != null && max != null && min > max) [min, max] = [max, min];
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}

/** Parses the `YYYY-MM-DDTHH:mm|YYYY-MM-DDTHH:mm` format `los/lib/datetime-range.ts` `serializeDatetimeRange` produces, as IST wall-clock instants. */
export function parseExportDatetimeRange(
  raw: string | undefined,
  field: string,
): { start: Date; end: Date } | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})(?::\d{2})?\|(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})(?::\d{2})?$/.exec(
      trimmed,
    );
  if (!match) {
    throw new BadRequestException(`${field} must be an ISO "from|to" datetime range.`);
  }
  const [, fromYmd, fromHm, toYmd, toHm] = match;
  const start = new Date(`${fromYmd}T${fromHm}:00.000+05:30`);
  const end = new Date(`${toYmd}T${toHm}:59.999+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException(`${field} is not a valid datetime range.`);
  }
  return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
}

export function matchesExportDatetimeRangeFilter(
  iso: string | null | undefined,
  filterValue: string,
  field: string,
): boolean {
  const range = parseExportDatetimeRange(filterValue, field);
  if (!range) return true;
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= range.start.getTime() && ts <= range.end.getTime();
}

/** Throws unless at least one of the given filter values is set — mirrors the download button staying disabled until a filter is applied. */
export function requireAtLeastOneExportFilter(
  values: Array<string | undefined>,
  message: string,
): void {
  if (!values.some((v) => v?.trim())) {
    throw new BadRequestException(message);
  }
}
