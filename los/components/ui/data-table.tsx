'use client';

import { DatetimeRangeFilter } from '@/components/ui/datetime-range-filter';
import { matchesDatetimeRange } from '@/lib/datetime-range';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

export const LOS_TABLE_PAGE_SIZE = 20;

export type SortDirection = 'asc' | 'desc';
export type SortState<T extends string = string> = { key: T; dir: SortDirection } | null;
export type ColumnFilters = Partial<Record<string, string>>;

export type DataTableFilterType = 'text' | 'select' | 'date' | 'datetime-range' | 'number';

export type DataTableColumnFilterConfig<T> = {
  type: DataTableFilterType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Custom match. When omitted, uses `getFilterValue` / `getSortValue` with type defaults. */
  matches?: (item: T, filterValue: string) => boolean;
};

export type DataTableColumn<T, K extends string = string> = {
  key: K;
  label: string;
  render: (item: T, index: number) => ReactNode;
  /** Value used for default text/number filtering and as fallback for sorting. */
  getFilterValue?: (item: T) => string | number | null | undefined;
  /** Explicit sort accessor. Falls back to `getFilterValue`. */
  getSortValue?: (item: T) => string | number | null;
  sortable?: boolean;
  filter?: DataTableColumnFilterConfig<T> | false;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataTableProps<T, K extends string = string> = {
  items: T[];
  columns: ReadonlyArray<DataTableColumn<T, K>>;
  getRowKey: (item: T, index: number) => string | number;
  entityLabel: string;
  pageSize?: number;
  /** When provided, enables a page-size selector (e.g. Source UTM). */
  pageSizeOptions?: number[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  noResultsMessage?: string;
  /** Extra controls rendered next to "Clear filters" (e.g. Refresh). */
  toolbarActions?: ReactNode;
  hint?: string;
  minWidth?: string;
  stickyHeader?: boolean;
  className?: string;
  tableClassName?: string;
  renderRowClassName?: (item: T, index: number) => string | undefined;
  /** Optional card shell; set false when embedding inside an existing card. */
  bordered?: boolean;
  showToolbar?: boolean;
  showPagination?: boolean;
  initialSort?: SortState<K>;
};

export const FILTER_CONTROL_CLASS =
  'mt-1.5 w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(23,44,113,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';

export const ACTIVE_INACTIVE_FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

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
    setSort,
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
  type?: DataTableFilterType;
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

  if (type === 'datetime-range') {
    return (
      <DatetimeRangeFilter
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? 'Date & time'}
        aria-label={ariaLabel ?? placeholder ?? 'Filter by date and time range'}
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
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  total: number;
  start: number;
  end: number;
  count: number;
  entityLabel: string;
  onPrev: () => void;
  onNext: () => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.6)] px-4 py-3">
      <span className="text-[0.78rem] text-brand-muted">
        {count === 0 ? `No ${entityLabel} found` : `${start}–${end} of ${count} ${entityLabel}`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizeOptions && pageSize != null && onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-[0.78rem] text-brand-muted">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-[32px] rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-2 text-[0.8rem] font-bold text-brand-text"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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

function getColumnFilterConfig<T, K extends string>(
  column: DataTableColumn<T, K>,
): DataTableColumnFilterConfig<T> | null {
  return column.filter && typeof column.filter === 'object' ? column.filter : null;
}

function defaultColumnMatches<T, K extends string>(
  item: T,
  column: DataTableColumn<T, K>,
  filterValue: string,
): boolean {
  const filter = getColumnFilterConfig(column);
  if (!filter) return true;

  if (filter.matches) return filter.matches(item, filterValue);

  const raw = column.getFilterValue?.(item);
  if (filter.type === 'date') {
    return isoDateKey(raw == null ? null : String(raw)) === filterValue;
  }
  if (filter.type === 'datetime-range') {
    return matchesDatetimeRange(raw, filterValue);
  }
  if (filter.type === 'number') {
    const target = Number(filterValue);
    if (!Number.isFinite(target)) return true;
    const actual = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(actual) && actual === target;
  }
  if (filter.type === 'select') {
    return String(raw ?? '').toLowerCase() === filterValue.toLowerCase();
  }
  return String(raw ?? '')
    .toLowerCase()
    .includes(filterValue.toLowerCase());
}

function getColumnSortValue<T, K extends string>(item: T, column: DataTableColumn<T, K> | undefined): string | number | null {
  if (!column) return null;
  if (column.getSortValue) return column.getSortValue(item);
  const value = column.getFilterValue?.(item);
  if (value == null) return null;
  return typeof value === 'number' ? value : String(value);
}

export function filterAndSortItems<T, K extends string>(
  items: T[],
  columns: ReadonlyArray<DataTableColumn<T, K>>,
  filters: ColumnFilters,
  sort: SortState<K>,
): T[] {
  const columnMap = new Map(columns.map((column) => [column.key, column]));

  const filtered = items.filter((item) => {
    for (const [key, rawValue] of Object.entries(filters)) {
      const filterValue = rawValue?.trim() ?? '';
      if (!filterValue) continue;
      const column = columnMap.get(key as K);
      if (!column || !getColumnFilterConfig(column)) continue;
      if (!defaultColumnMatches(item, column, filterValue)) return false;
    }
    return true;
  });

  return sortItems(filtered, sort, (item, key) => getColumnSortValue(item, columnMap.get(key)));
}

export function DataTable<T, K extends string = string>({
  items,
  columns,
  getRowKey,
  entityLabel,
  pageSize: pageSizeProp,
  pageSizeOptions,
  loading = false,
  error = null,
  onRetry,
  emptyMessage,
  noResultsMessage,
  toolbarActions,
  hint = 'Click a column title to sort. Use the search boxes below each column to filter.',
  minWidth = '720px',
  stickyHeader = false,
  className,
  tableClassName,
  renderRowClassName,
  bordered = true,
  showToolbar = true,
  showPagination = true,
  initialSort = null,
}: DataTableProps<T, K>) {
  const defaultPageSize = pageSizeProp ?? pageSizeOptions?.[0] ?? LOS_TABLE_PAGE_SIZE;
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const {
    columnFilters,
    sort,
    currentPage,
    setCurrentPage,
    setColumnFilter,
    clearColumnFilters,
    toggleSort,
    setSort,
  } = useColumnTableState([items.length, pageSize]);

  useEffect(() => {
    if (initialSort) setSort(initialSort);
    // only seed once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pageSizeProp != null) setPageSize(pageSizeProp);
  }, [pageSizeProp]);

  const processed = useMemo(
    () => filterAndSortItems(items, columns, columnFilters, sort as SortState<K>),
    [items, columns, columnFilters, sort],
  );

  const { paginated, safePage, totalPages, rangeStart, rangeEnd, count } = showPagination
    ? paginateItems(processed, currentPage, pageSize)
    : {
        paginated: processed,
        safePage: 1,
        totalPages: 1,
        rangeStart: processed.length === 0 ? 0 : 1,
        rangeEnd: processed.length,
        count: processed.length,
      };

  const hasFilters = hasActiveColumnFilters(columnFilters) || sort != null;
  const anyFilterable = columns.some((column) => getColumnFilterConfig(column) != null);

  const shellClass = bordered
    ? `overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.1)] ${className ?? ''}`
    : className ?? '';

  const shellStyle = bordered
    ? { background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.94))' }
    : undefined;

  return (
    <div className={shellClass} style={shellStyle}>
      {showToolbar && (anyFilterable || toolbarActions || hint) ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-4 py-2.5">
          {hint ? (
            <p className="m-0 min-w-[180px] flex-1 text-[0.76rem] text-brand-muted">{hint}</p>
          ) : (
            <span className="flex-1" />
          )}
          {hasFilters ? (
            <button
              type="button"
              onClick={clearColumnFilters}
              className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)]"
            >
              Clear filters
            </button>
          ) : null}
          {toolbarActions}
        </div>
      ) : null}

      {error ? (
        <div className="grid gap-3 p-8 text-center">
          <p className="m-0 text-[0.88rem] text-[#8d3434]">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mx-auto h-[36px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-4 text-[0.84rem] font-bold text-brand-text"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : loading ? (
        <div className="p-10 text-center text-[0.88rem] text-brand-muted">
          <span className="inline-block animate-pulse">Loading {entityLabel}…</span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table
              className={`w-full border-collapse text-left text-[0.84rem] ${tableClassName ?? ''}`}
              style={{ minWidth }}
            >
              <thead
                className={
                  stickyHeader
                    ? 'sticky top-0 z-[1] bg-[rgba(248,250,255,0.96)] align-top'
                    : 'align-top'
                }
              >
                <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)]">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-3 py-2 align-top ${column.headerClassName ?? ''}`}
                    >
                      <DataTableColumnHeader
                        label={column.label}
                        sortKey={column.key}
                        sort={sort as SortState<K>}
                        onSort={(key) => toggleSort(key)}
                        sortable={column.sortable !== false && (column.getSortValue != null || column.getFilterValue != null)}
                      >
                        {(() => {
                          const filter = getColumnFilterConfig(column);
                          if (!filter) return null;
                          return (
                            <DataTableColumnFilter
                              type={filter.type}
                              value={columnFilters[column.key] ?? ''}
                              onChange={(value) => setColumnFilter(column.key, value)}
                              placeholder={filter.placeholder}
                              options={filter.options}
                              aria-label={`Filter ${column.label}`}
                            />
                          );
                        })()}
                      </DataTableColumnHeader>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-[0.86rem] text-brand-muted"
                    >
                      {hasFilters
                        ? (noResultsMessage ?? `No ${entityLabel} match your filters.`)
                        : (emptyMessage ?? `No ${entityLabel} available right now.`)}
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, index) => (
                    <tr
                      key={getRowKey(item, index)}
                      className={
                        renderRowClassName?.(item, index) ??
                        `border-b border-[rgba(23,44,113,0.05)] transition-colors hover:bg-[rgba(20,150,243,0.025)] ${
                          index === paginated.length - 1 ? 'border-b-0' : ''
                        }`
                      }
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-3 py-2.5 align-middle ${column.cellClassName ?? ''}`}
                        >
                          {column.render(item, index)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showPagination ? (
            <DataTablePagination
              page={safePage}
              total={totalPages}
              start={rangeStart}
              end={rangeEnd}
              count={count}
              entityLabel={entityLabel}
              onPrev={() => setCurrentPage(Math.max(1, safePage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageSizeChange={
                pageSizeOptions
                  ? (size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }
                  : undefined
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/** Shared Active/Inactive status pill used by masters and eligibility tables. */
export function DataTableStatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-full px-3 py-1 text-[0.78rem] font-extrabold ${
        isActive
          ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]'
          : 'bg-[rgba(239,68,68,0.1)] text-[#991b1b]'
      }`}
    >
      <span
        className={`h-[7px] w-[7px] rounded-full ${isActive ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
        aria-hidden
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export function matchesActiveInactiveFilter(isActive: boolean, filterValue: string): boolean {
  const normalized = filterValue.toLowerCase();
  if (normalized === 'active' || normalized === 'true') return isActive;
  if (normalized === 'inactive' || normalized === 'false') return !isActive;
  return true;
}
