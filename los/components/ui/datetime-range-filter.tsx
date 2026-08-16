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

const PANEL_WIDTH = 352;
const FIELD_CLASS =
  'w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(23,44,113,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';

function ymdInRange(ymd: string, fromYmd: string, toYmd: string): boolean {
  const start = fromYmd <= toYmd ? fromYmd : toYmd;
  const end = fromYmd <= toYmd ? toYmd : fromYmd;
  return ymd >= start && ymd <= end;
}

export function DatetimeRangeFilter({
  value,
  onChange,
  placeholder = 'Date & time',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const parsed = parseDatetimeRange(value);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<DatetimeRangeValue>(
    parsed ?? datetimeRangeFromPreset('today'),
  );
  const [pendingEnd, setPendingEnd] = useState(false);
  const [view, setView] = useState(() => {
    const parts = parseYmd((parsed ?? datetimeRangeFromPreset('today')).fromYmd);
    return { year: parts?.year ?? getIstParts().year, month: parts?.month ?? getIstParts().month };
  });
  const labelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const commit = useCallback(
    (next: DatetimeRangeValue) => {
      const normalized = normalizeDatetimeRange(next);
      setDraft(normalized);
      onChange(serializeDatetimeRange(normalized));
    },
    [onChange],
  );

  const openPanel = useCallback(() => {
    const current = parseDatetimeRange(value);
    const next = current ?? datetimeRangeFromPreset('today');
    const parts = parseYmd(next.toYmd) ?? parseYmd(next.fromYmd) ?? getIstParts();
    setDraft(next);
    setPendingEnd(false);
    setView({ year: parts.year, month: parts.month });
    setOpen(true);
  }, [value]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const maxLeft = window.innerWidth - PANEL_WIDTH - margin;
    const left = Math.max(margin, Math.min(rect.right - PANEL_WIDTH, maxLeft));
    const height = panelRef.current?.offsetHeight ?? 520;
    const below = rect.bottom + 6;
    const top =
      below + height > window.innerHeight - margin
        ? Math.max(margin, rect.top - height - 6)
        : below;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, updatePosition]);

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
    function onReposition() {
      updatePosition();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  const todayYmd = useMemo(() => {
    const parts = getIstParts();
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }, [open]);

  const activePreset = matchingDatetimeRangePreset(draft);
  const cells = monthGrid(view.year, view.month);
  const triggerLabel = parsed ? formatDatetimeRangeLabel(parsed) : placeholder;

  function handleDayClick(ymd: string) {
    if (!pendingEnd) {
      setDraft({ fromYmd: ymd, fromHm: '00:00', toYmd: ymd, toHm: '23:59' });
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
    commit(next);
  }

  const panel = open && mounted ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={labelId}
      className="fixed z-[90] w-[352px] rounded-[16px] border border-[rgba(23,44,113,0.14)] bg-white p-3 shadow-[0_18px_50px_rgba(23,44,113,0.22)]"
      style={{ top: pos.top, left: pos.left }}
    >
      <p id={labelId} className="m-0 mb-2 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
        Fetched date & time
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {DATETIME_RANGE_PRESETS.map((preset) => {
          const selected = activePreset === preset.id && !pendingEnd;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const next = datetimeRangeFromPreset(preset.id);
                const parts = parseYmd(next.toYmd) ?? getIstParts();
                setView({ year: parts.year, month: parts.month });
                setPendingEnd(false);
                commit(next);
              }}
              className={cx(
                'h-7 rounded-full border px-2.5 text-[0.7rem] font-bold transition-colors',
                selected
                  ? 'border-[rgba(20,150,243,0.35)] bg-[rgba(20,150,243,0.12)] text-brand-blue'
                  : 'border-[rgba(23,44,113,0.12)] bg-white text-brand-navy hover:border-[rgba(20,150,243,0.28)]',
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView((prev) => shiftMonth(prev.year, prev.month, -1))}
          className="grid h-8 w-8 place-items-center rounded-[8px] border border-[rgba(23,44,113,0.12)] bg-white text-brand-navy hover:border-[rgba(20,150,243,0.28)]"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-[0.86rem] font-extrabold text-brand-navy">{formatMonthYear(view.year, view.month)}</span>
        <button
          type="button"
          onClick={() => setView((prev) => shiftMonth(prev.year, prev.month, 1))}
          className="grid h-8 w-8 place-items-center rounded-[8px] border border-[rgba(23,44,113,0.12)] bg-white text-brand-navy hover:border-[rgba(20,150,243,0.28)]"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
            {label}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} />;
          }
          const isStart = cell.ymd === draft.fromYmd;
          const isEnd = cell.ymd === draft.toYmd;
          const inSpan = ymdInRange(cell.ymd, draft.fromYmd, draft.toYmd);
          const isToday = cell.ymd === todayYmd;
          return (
            <button
              key={cell.ymd}
              type="button"
              onClick={() => handleDayClick(cell.ymd)}
              className={cx(
                'h-8 rounded-[8px] text-[0.75rem] font-semibold transition-colors',
                isStart || isEnd
                  ? 'bg-brand-blue text-white'
                  : inSpan
                    ? 'bg-[rgba(20,150,243,0.12)] text-brand-blue'
                    : 'text-brand-navy hover:bg-[rgba(20,150,243,0.08)]',
                isToday && !isStart && !isEnd ? 'ring-1 ring-inset ring-[rgba(20,150,243,0.45)]' : '',
              )}
            >
              {Number(cell.ymd.slice(-2))}
            </button>
          );
        })}
      </div>
      <p className="m-0 mb-3 text-[0.68rem] text-brand-muted">
        {pendingEnd ? 'Click an end date to complete the range.' : 'Click a start date, then an end date.'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-[0.68rem] font-bold text-brand-muted">
          From date
          <input
            type="date"
            value={draft.fromYmd}
            onChange={(event) => {
              const next = { ...draft, fromYmd: event.target.value };
              setDraft(next);
              if (event.target.value && draft.toYmd) commit(next);
            }}
            className={FIELD_CLASS}
          />
        </label>
        <label className="grid gap-1 text-[0.68rem] font-bold text-brand-muted">
          From time
          <input
            type="time"
            value={draft.fromHm}
            onChange={(event) => {
              const next = { ...draft, fromHm: normalizeHm(event.target.value, '00:00') };
              setDraft(next);
              commit(next);
            }}
            className={FIELD_CLASS}
          />
        </label>
        <label className="grid gap-1 text-[0.68rem] font-bold text-brand-muted">
          To date
          <input
            type="date"
            value={draft.toYmd}
            onChange={(event) => {
              const next = { ...draft, toYmd: event.target.value };
              setDraft(next);
              if (event.target.value && draft.fromYmd) commit(next);
            }}
            className={FIELD_CLASS}
          />
        </label>
        <label className="grid gap-1 text-[0.68rem] font-bold text-brand-muted">
          To time
          <input
            type="time"
            value={draft.toHm}
            onChange={(event) => {
              const next = { ...draft, toHm: normalizeHm(event.target.value, '23:59') };
              setDraft(next);
              commit(next);
            }}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setPendingEnd(false);
            onChange('');
            setOpen(false);
          }}
          className="h-8 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.76rem] font-bold text-brand-text hover:bg-[rgba(20,150,243,0.06)]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            commit(draft);
            setOpen(false);
          }}
          className="h-8 rounded-[8px] border border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.12)] px-3 text-[0.76rem] font-bold text-brand-blue"
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
          parsed ? 'border-[rgba(20,150,243,0.28)] text-brand-navy' : 'text-brand-muted',
        )}
      >
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <span aria-hidden className="shrink-0 text-[0.62rem] opacity-70">▾</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
