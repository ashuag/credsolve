'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

export const LOS_TABLE_PAGE_SIZE = 20;

export type SortDirection = 'asc' | 'desc';
export type SortState<T extends string = string> = { key: T; dir: SortDirection } | null;
export type ColumnFilters = Partial<Record<string, string>>;

export const FILTER_CONTROL_CLASS =
  'mt-1.5 w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(23,44,113,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';

export function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function hasActiveColumnFilters(filters: ColumnFilters): boolean {
  return Object.values(filters).some((value) => value?.trim());
}

export function paginateItems<T>(items: T[], page: number, pageSize = LOS_TABLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = items.slice(pageStart, pageStart + pageSize);
  const rangeStart = items.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + pageSize, items.length);

  return {
    paginated,
    safePage,
    totalPages,
    rangeStart,
    rangeEnd,
    count: items.length,
  };
}

export function useColumnTableState(resetDeps: unknown[] = []) {
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<SortState>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const setColumnFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => {
      if (!value.trim()) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearColumnFilters = useCallback(() => {
    setColumnFilters({});
    setSort(null);
  }, []);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...resetDeps, columnFilters, sort]);

  return {
    columnFilters,
    sort,
    currentPage,
    setCurrentPage,
    setColumnFilter,
    clearColumnFilters,
    toggleSort,
  };
}

export function DataTableColumnFilter({
  value,
  onChange,
  placeholder,
  type = 'text',
  options,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'select' | 'date' | 'number';
  options?: Array<{ value: string; label: string }>;
  'aria-label'?: string;
}) {
  if (type === 'select') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FILTER_CONTROL_CLASS}
        aria-label={ariaLabel ?? placeholder}
      >
        <option value="">All</option>
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FILTER_CONTROL_CLASS}
        aria-label={ariaLabel ?? placeholder ?? 'Filter by date'}
      />
    );
  }

  if (type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Value…'}
        className={`${FILTER_CONTROL_CLASS} placeholder:text-brand-muted/70`}
        aria-label={ariaLabel ?? placeholder}
      />
    );
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Search…'}
      className={`${FILTER_CONTROL_CLASS} placeholder:text-brand-muted/70`}
      aria-label={ariaLabel ?? placeholder}
    />
  );
}

export function DataTableColumnHeader<T extends string>({
  label,
  sortKey,
  sort,
  onSort,
  sortable = true,
  children,
}: {
  label: string;
  sortKey: T;
  sort: SortState<T>;
  onSort: (key: T) => void;
  sortable?: boolean;
  children?: ReactNode;
}) {
  const active = sort?.key === sortKey;
  const icon = !active ? '↕' : sort.dir === 'asc' ? '↑' : '↓';

  return (
    <>
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={`flex w-full items-center gap-1 border-0 bg-transparent p-0 text-left text-[0.68rem] font-extrabold tracking-[0.08em] uppercase cursor-pointer ${
            active ? 'text-brand-blue' : 'text-brand-muted hover:text-brand-text'
          }`}
          title={`Sort by ${label}`}
        >
          <span className="min-w-0 flex-1">{label}</span>
          <span className="shrink-0 text-[0.62rem] leading-none opacity-80">{icon}</span>
        </button>
      ) : (
        <span className="block text-[0.68rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
          {label}
        </span>
      )}
      {children}
    </>
  );
}

export function DataTablePagination({
  page,
  total,
  start,
  end,
  count,
  entityLabel,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  start: number;
  end: number;
  count: number;
  entityLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.6)] px-4 py-3">
      <span className="text-[0.78rem] text-brand-muted">
        {count === 0 ? `No ${entityLabel} found` : `${start}–${end} of ${count} ${entityLabel}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.05)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-[0.78rem] font-bold text-brand-muted">
          {page} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= total}
          className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.05)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export function sortItems<T, K extends string>(
  items: T[],
  sort: SortState<K>,
  getValue: (item: T, key: K) => string | number | null,
): T[] {
  if (!sort) return items;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => compareSortValues(getValue(a, sort.key), getValue(b, sort.key)) * dir);
}

export function isoDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoDateTimestamp(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}
