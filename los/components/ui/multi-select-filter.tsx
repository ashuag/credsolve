'use client';

import { cx } from '@/lib/cx';
import {
  formatMultiSelectLabel,
  parseMultiSelect,
  serializeMultiSelect,
} from '@/lib/multi-select';
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
  'w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(23,44,113,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';

export function MultiSelectFilter({
  value,
  onChange,
  options,
  placeholder = 'All',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const selected = parseMultiSelect(value);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const labelId = useId();
  const items = options ?? [];

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = Math.max(panelRef.current?.offsetWidth ?? 180, rect.width);
    const height = panelRef.current?.offsetHeight ?? 280;
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
  }, [open, selected.length, updatePosition]);

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

  function toggle(optionValue: string) {
    const next = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue];
    onChange(serializeMultiSelect(items
      .map((option) => option.value)
      .filter((item) => next.includes(item))));
  }

  const triggerLabel = formatMultiSelectLabel(selected, items, placeholder);

  const panel = open && mounted ? (
    <div
      ref={panelRef}
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby={labelId}
      className="fixed z-[90] min-w-[168px] overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.14)] bg-white py-1.5 shadow-[0_18px_50px_rgba(23,44,113,0.22)]"
      style={{ top: pos.top, left: pos.left, width: Math.max(168, triggerRef.current?.offsetWidth ?? 0) }}
    >
      <p id={labelId} className="m-0 px-3 pb-1.5 pt-0.5 text-[0.64rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
        {placeholder}
      </p>
      <div className="max-h-[240px] overflow-y-auto">
        {items.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cx(
                'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.78rem] font-semibold transition-colors hover:bg-[rgba(20,150,243,0.07)]',
                checked ? 'text-brand-navy' : 'text-brand-text',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.value)}
                className="h-3.5 w-3.5 accent-[#1496f3]"
                aria-label={option.label}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-[rgba(23,44,113,0.08)] px-2 pt-1.5">
        <button
          type="button"
          onClick={() => onChange('')}
          className="h-7 rounded-[7px] border-0 bg-transparent px-2 text-[0.72rem] font-bold text-brand-muted hover:text-brand-navy"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(serializeMultiSelect(items.map((option) => option.value)));
          }}
          className="h-7 rounded-[7px] border-0 bg-transparent px-2 text-[0.72rem] font-bold text-brand-blue hover:underline"
        >
          Select all
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ?? placeholder}
        className={cx(
          FIELD_CLASS,
          'mt-1.5 inline-flex min-w-[88px] items-center justify-between gap-1 text-left',
          selected.length > 0 ? 'border-[rgba(20,150,243,0.28)] text-brand-navy' : 'text-brand-muted',
        )}
      >
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <span aria-hidden className="shrink-0 text-[0.62rem] opacity-70">▾</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
