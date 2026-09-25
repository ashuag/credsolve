'use client';

import { cx } from '@/lib/cx';
import {
  formatNumberRangeLabel,
  matchingNumberRangePreset,
  normalizeNumberRange,
  parseNumberRange,
  serializeNumberRange,
  type NumberRangePreset,
  type NumberRangeValue,
} from '@/lib/number-range';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const FIELD_CLASS =
  'w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(15,39,72,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';
const INPUT_CLASS =
  'h-[32px] w-full rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-white px-2.5 text-[0.8rem] font-semibold text-brand-navy outline-none focus:border-[rgba(34,197,94,0.45)]';

function emptyRange(): NumberRangeValue {
  return { min: null, max: null };
}

export function NumberRangeFilter({
  value,
  onChange,
  placeholder = 'Range',
  min,
  max,
  step,
  presets,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  presets?: NumberRangePreset[];
  'aria-label'?: string;
}) {
  const parsed = parseNumberRange(value);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState<NumberRangeValue>(parsed ?? emptyRange());
  const [minText, setMinText] = useState(parsed?.min != null ? String(parsed.min) : '');
  const [maxText, setMaxText] = useState(parsed?.max != null ? String(parsed.max) : '');
  const labelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncDraft = useCallback((next: NumberRangeValue) => {
    const normalized = normalizeNumberRange(next);
    setDraft(normalized);
    setMinText(normalized.min != null ? String(normalized.min) : '');
    setMaxText(normalized.max != null ? String(normalized.max) : '');
  }, []);

  const openPanel = useCallback(() => {
    const current = parseNumberRange(value) ?? emptyRange();
    syncDraft(current);
    setOpen(true);
  }, [syncDraft, value]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = panelRef.current?.offsetWidth ?? 280;
    const height = panelRef.current?.offsetHeight ?? 240;
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(rect.left, maxLeft));
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
  }, [open, updatePosition, draft, minText, maxText]);

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
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  function parseBound(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  function applyRange(next: NumberRangeValue) {
    const normalized = normalizeNumberRange(next);
    syncDraft(normalized);
    onChange(serializeNumberRange(normalized));
  }

  const activePreset = matchingNumberRangePreset(draft, presets);
  const triggerLabel = parsed ? formatNumberRangeLabel(parsed, presets) : placeholder;

  const panel = open && mounted ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={labelId}
      className="fixed z-[90] w-[280px] rounded-[16px] border border-[rgba(15,39,72,0.14)] bg-white p-3 shadow-[0_18px_50px_rgba(15,39,72,0.22)]"
      style={{ top: pos.top, left: pos.left }}
    >
      <p id={labelId} className="m-0 mb-2 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
        {placeholder}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="grid gap-1 text-[0.68rem] font-bold text-brand-muted">
          Min
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step ?? 1}
            value={minText}
            placeholder={min != null ? String(min) : 'Any'}
            onChange={(event) => {
              setMinText(event.target.value);
              setDraft((prev) => ({ ...prev, min: parseBound(event.target.value) }));
            }}
            className={INPUT_CLASS}
            aria-label="Minimum value"
          />
        </label>
        <span className="mb-2 text-[0.78rem] font-bold text-brand-muted">–</span>
        <label className="grid gap-1 text-[0.68rem] font-bold text-brand-muted">
          Max
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step ?? 1}
            value={maxText}
            placeholder={max != null ? String(max) : 'Any'}
            onChange={(event) => {
              setMaxText(event.target.value);
              setDraft((prev) => ({ ...prev, max: parseBound(event.target.value) }));
            }}
            className={INPUT_CLASS}
            aria-label="Maximum value"
          />
        </label>
      </div>
      {presets?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const selected = activePreset === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyRange({ min: preset.min ?? null, max: preset.max ?? null })}
                className={cx(
                  'h-7 rounded-full border px-2.5 text-[0.7rem] font-bold transition-colors',
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
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            syncDraft(emptyRange());
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
            applyRange(draft);
            setOpen(false);
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
          'mt-1.5 inline-flex min-w-[108px] items-center justify-between gap-1 text-left',
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
