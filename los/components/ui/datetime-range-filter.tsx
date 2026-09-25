'use client';

import { cx } from '@/lib/cx';
import {
  DATETIME_RANGE_PRESETS,
  WEEKDAY_LABELS,
  datetimeRangeFromPreset,
  formatDatetimeRangeLabel,
  formatMonthYear,
  getIstParts,
  matchingDatetimeRangePreset,
  monthGrid,
  normalizeDatetimeRange,
  normalizeHm,
  parseDatetimeRange,
  parseYmd,
  serializeDatetimeRange,
  shiftMonth,
  ymdInRange,
  type DatetimeRangeValue,
} from '@/lib/datetime-range';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const DUAL_BREAKPOINT = 720;
const FIELD_CLASS =
  'w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(15,39,72,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';
const INPUT_CLASS =
  'h-[32px] w-full rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-white px-2 text-[0.78rem] font-semibold text-brand-navy outline-none focus:border-[rgba(34,197,94,0.45)]';

function MonthCalendar({
  year,
  month,
  fromYmd,
  toYmd,
  todayYmd,
  hoverYmd,
  pendingEnd,
  onDayClick,
  onDayHover,
}: {
  year: number;
  month: number;
  fromYmd: string;
  toYmd: string;
  todayYmd: string;
  hoverYmd: string | null;
  pendingEnd: boolean;
  onDayClick: (ymd: string) => void;
  onDayHover: (ymd: string | null) => void;
}) {
  const cells = monthGrid(year, month);
  const previewEnd = pendingEnd && hoverYmd ? hoverYmd : toYmd;
  const rangeFrom = fromYmd;
  const rangeTo = previewEnd;

  return (
    <div className="min-w-[236px] flex-1">
      <p className="mb-2 text-center text-[0.82rem] font-extrabold text-brand-navy">
        {formatMonthYear(year, month)}
      </p>
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="py-1 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted"
          >
            {label}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <span key={`empty-${year}-${month}-${index}`} className="h-8" />;
          const isStart = cell.ymd === rangeFrom;
          const isEnd = cell.ymd === rangeTo;
          const inSpan = ymdInRange(cell.ymd, rangeFrom, rangeTo);
          const isToday = cell.ymd === todayYmd;
          const isSingle = rangeFrom === rangeTo;
          const prev = cells[index - 1]?.ymd;
          const next = cells[index + 1]?.ymd;
          const isRowStart = index % 7 === 0 || !prev;
          const isRowEnd = index % 7 === 6 || !next;
          return (
            <button
              key={cell.ymd}
              type="button"
              onClick={() => onDayClick(cell.ymd)}
              onMouseEnter={() => onDayHover(cell.ymd)}
              onMouseLeave={() => onDayHover(null)}
              className={cx(
                'relative h-8 text-[0.75rem] font-semibold transition-colors',
                inSpan && !isStart && !isEnd ? 'bg-[rgba(34,197,94,0.1)] text-brand-blue' : '',
                inSpan && isRowStart && !isStart ? 'rounded-l-full' : '',
                inSpan && isRowEnd && !isEnd ? 'rounded-r-full' : '',
                isStart || isEnd ? 'z-[1] text-white' : 'text-brand-navy hover:bg-[rgba(34,197,94,0.08)]',
                isSingle && isStart ? 'rounded-full' : '',
                isStart && !isSingle ? 'rounded-l-full' : '',
                isEnd && !isSingle && !isStart ? 'rounded-r-full' : '',
                isToday && !isStart && !isEnd ? 'ring-1 ring-inset ring-[rgba(34,197,94,0.45)] rounded-[8px]' : '',
              )}
            >
              {(isStart || isEnd) ? (
                <span className="absolute inset-[3px] rounded-full bg-brand-blue" />
              ) : null}
              <span className="relative z-[1]">{Number(cell.ymd.slice(-2))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatetimeRangeFilter({
  value,
  onChange,
  placeholder = 'Date & time',
  title,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  'aria-label'?: string;
}) {
  const parsed = parseDatetimeRange(value);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dual, setDual] = useState(true);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<DatetimeRangeValue>(
    parsed ?? datetimeRangeFromPreset('today'),
  );
  const [pendingEnd, setPendingEnd] = useState(false);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);
  const [leftView, setLeftView] = useState(() => {
    const parts = parseYmd((parsed ?? datetimeRangeFromPreset('today')).fromYmd);
    return { year: parts?.year ?? getIstParts().year, month: parts?.month ?? getIstParts().month };
  });
  const labelId = useId();
  const rightView = shiftMonth(leftView.year, leftView.month, 1);

  useEffect(() => {
    setMounted(true);
  }, []);

  const commit = useCallback(
    (next: DatetimeRangeValue, close = false) => {
      const normalized = normalizeDatetimeRange(next);
      setDraft(normalized);
      onChange(serializeDatetimeRange(normalized));
      if (close) setOpen(false);
    },
    [onChange],
  );

  const openPanel = useCallback(() => {
    const current = parseDatetimeRange(value);
    const next = current ?? datetimeRangeFromPreset('today');
    const parts = parseYmd(next.fromYmd) ?? getIstParts();
    setDraft(next);
    setPendingEnd(false);
    setHoverYmd(null);
    setLeftView({ year: parts.year, month: parts.month });
    setDual(window.innerWidth >= DUAL_BREAKPOINT);
    setOpen(true);
  }, [value]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = panelRef.current?.offsetWidth ?? (dual ? 720 : 352);
    const height = panelRef.current?.offsetHeight ?? 520;
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(rect.right - Math.min(width, rect.width + 240), maxLeft));
    const below = rect.bottom + 6;
    const top =
      below + height > window.innerHeight - margin
        ? Math.max(margin, rect.top - height - 6)
        : below;
    setPos({ top, left });
  }, [dual]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, updatePosition, dual, leftView, pendingEnd]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onResize() {
      setDual(window.innerWidth >= DUAL_BREAKPOINT);
      updatePosition();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  const todayYmd = useMemo(() => {
    const parts = getIstParts();
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }, [open]);

  const activePreset = matchingDatetimeRangePreset(draft);
  const triggerLabel = parsed ? formatDatetimeRangeLabel(parsed) : placeholder;
  const heading = title ?? placeholder;

  function handleDayClick(ymd: string) {
    if (!pendingEnd) {
      setDraft({ fromYmd: ymd, fromHm: draft.fromHm || '00:00', toYmd: ymd, toHm: draft.toHm || '23:59' });
      setPendingEnd(true);
      return;
    }
    const next = normalizeDatetimeRange({
      fromYmd: draft.fromYmd,
      fromHm: draft.fromHm,
      toYmd: ymd,
      toHm: draft.toHm,
    });
    setPendingEnd(false);
    setHoverYmd(null);
    setDraft(next);
  }

  const presetList = (
    <div className={cx('flex gap-1.5', dual ? 'w-[148px] shrink-0 flex-col' : 'mb-3 flex-wrap')}>
      {DATETIME_RANGE_PRESETS.map((preset) => {
        const selected = activePreset === preset.id && !pendingEnd;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              const next = datetimeRangeFromPreset(preset.id);
              const parts = parseYmd(next.fromYmd) ?? getIstParts();
              setLeftView({ year: parts.year, month: parts.month });
              setPendingEnd(false);
              setHoverYmd(null);
              commit(next);
            }}
            className={cx(
              'h-8 rounded-[8px] border px-2.5 text-left text-[0.72rem] font-bold transition-colors',
              dual ? 'w-full' : 'rounded-full',
              selected
                ? 'border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] text-brand-blue'
                : 'border-[rgba(15,39,72,0.12)] bg-white text-brand-navy hover:border-[rgba(34,197,94,0.28)]',
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );

  const navButtonClass =
    'grid h-8 w-8 place-items-center rounded-[8px] border border-[rgba(15,39,72,0.12)] bg-white text-brand-navy hover:border-[rgba(34,197,94,0.28)]';

  const panel = open && mounted ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={labelId}
      className={cx(
        'fixed z-[90] rounded-[18px] border border-[rgba(15,39,72,0.14)] bg-white p-3 shadow-[0_18px_50px_rgba(15,39,72,0.22)]',
        dual ? 'w-[min(736px,calc(100vw-16px))]' : 'w-[min(352px,calc(100vw-16px))]',
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p id={labelId} className="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
            {heading}
          </p>
          <p className="m-0 mt-0.5 text-[0.78rem] font-bold text-brand-navy">
            {formatDatetimeRangeLabel(draft)}
            {draft.fromHm !== '00:00' || draft.toHm !== '23:59'
              ? ''
              : pendingEnd
                ? ' · pick end date'
                : ''}
          </p>
        </div>
        <p className="m-0 text-[0.66rem] font-semibold text-brand-muted">IST</p>
      </div>

      <div className={cx('gap-3', dual ? 'flex' : 'block')}>
        {presetList}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLeftView((prev) => shiftMonth(prev.year, prev.month, -12))}
                className={navButtonClass}
                aria-label="Previous year"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setLeftView((prev) => shiftMonth(prev.year, prev.month, -1))}
                className={navButtonClass}
                aria-label="Previous month"
              >
                ‹
              </button>
            </div>
            <span className="px-2 text-[0.78rem] font-extrabold text-brand-navy">
              {dual
                ? `${formatMonthYear(leftView.year, leftView.month)} – ${formatMonthYear(rightView.year, rightView.month)}`
                : formatMonthYear(leftView.year, leftView.month)}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLeftView((prev) => shiftMonth(prev.year, prev.month, 1))}
                className={navButtonClass}
                aria-label="Next month"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setLeftView((prev) => shiftMonth(prev.year, prev.month, 12))}
                className={navButtonClass}
                aria-label="Next year"
              >
                »
              </button>
            </div>
          </div>

          <div className={cx('gap-4', dual ? 'flex' : 'block')} onMouseLeave={() => setHoverYmd(null)}>
            <MonthCalendar
              year={leftView.year}
              month={leftView.month}
              fromYmd={draft.fromYmd}
              toYmd={draft.toYmd}
              todayYmd={todayYmd}
              hoverYmd={hoverYmd}
              pendingEnd={pendingEnd}
              onDayClick={handleDayClick}
              onDayHover={setHoverYmd}
            />
            {dual ? (
              <MonthCalendar
                year={rightView.year}
                month={rightView.month}
                fromYmd={draft.fromYmd}
                toYmd={draft.toYmd}
                todayYmd={todayYmd}
                hoverYmd={hoverYmd}
                pendingEnd={pendingEnd}
                onDayClick={handleDayClick}
                onDayHover={setHoverYmd}
              />
            ) : null}
          </div>

          <p className="m-0 mb-3 mt-2 text-[0.68rem] text-brand-muted">
            {pendingEnd ? 'Click an end date to complete the range.' : 'Click a start date, then an end date. Times are optional.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[12px] border border-[rgba(15,39,72,0.1)] bg-[rgba(248,250,255,0.8)] p-2">
              <p className="m-0 mb-1.5 text-[0.64rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">From</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={draft.fromYmd}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setDraft((prev) => ({ ...prev, fromYmd: event.target.value }));
                    setPendingEnd(false);
                  }}
                  className={INPUT_CLASS}
                  aria-label="From date"
                />
                <input
                  type="time"
                  value={draft.fromHm}
                  onChange={(event) => {
                    setDraft((prev) => ({ ...prev, fromHm: normalizeHm(event.target.value, '00:00') }));
                  }}
                  className={INPUT_CLASS}
                  aria-label="From time"
                />
              </div>
            </div>
            <div className="rounded-[12px] border border-[rgba(15,39,72,0.1)] bg-[rgba(248,250,255,0.8)] p-2">
              <p className="m-0 mb-1.5 text-[0.64rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">To</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={draft.toYmd}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setDraft((prev) => ({ ...prev, toYmd: event.target.value }));
                    setPendingEnd(false);
                  }}
                  className={INPUT_CLASS}
                  aria-label="To date"
                />
                <input
                  type="time"
                  value={draft.toHm}
                  onChange={(event) => {
                    setDraft((prev) => ({ ...prev, toHm: normalizeHm(event.target.value, '23:59') }));
                  }}
                  className={INPUT_CLASS}
                  aria-label="To time"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setPendingEnd(false);
            onChange('');
            setOpen(false);
          }}
          className="h-8 rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-3 text-[0.76rem] font-bold text-brand-text hover:bg-[rgba(34,197,94,0.06)]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingEnd(false);
            commit(draft, true);
          }}
          className="h-8 rounded-[8px] border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.12)] px-3 text-[0.76rem] font-bold text-brand-blue"
        >
          Apply
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel ?? placeholder}
        className={cx(
          FIELD_CLASS,
          'mt-1.5 inline-flex min-w-[148px] items-center justify-between gap-1 text-left',
          parsed ? 'border-[rgba(34,197,94,0.28)] text-brand-navy' : 'text-brand-muted',
        )}
      >
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <span aria-hidden className="shrink-0 text-[0.62rem] opacity-70">▾</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
