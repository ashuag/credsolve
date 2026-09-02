'use client';

import {type ChangeEvent, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {cn} from '@/lib/cn';
import {
  defaultDobMonth,
  formatDateDisplay,
  formatDobInput,
  getCalendarDays,
  MONTH_LABELS,
  parseDobDisplay,
  startOfMonth,
  WEEKDAY_LABELS,
} from '@/lib/date-utils';

/* ── Icons ──────────────────────────────────────────────────────────────── */

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Types ───────────────────────────────────────────────────────────────── */

type DatePickerFieldProps = {
  id?: string;
  name?: string;
  label: string;
  /** Set false when an outer field wrapper already renders the label. */
  showInputLabel?: boolean;
  /** Display value in DD/MM/YYYY format. */
  value: string;
  /** Called with the new DD/MM/YYYY string as the user types or selects. */
  onChange: (value: string) => void;
  minYear?: number;
  /** Calendar will not allow selecting dates after this. Defaults to today. */
  maxDate?: Date;
  /** Optional hint shown below the input. */
  hint?: string;
  /** Additional classes for the outer wrapper. */
  className?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
};

/* ── Component ───────────────────────────────────────────────────────────── */

const LABEL_CLASS =
  'text-[0.84rem] font-extrabold text-brand-navy transition-colors duration-[180ms] group-focus-within:text-brand-blue';

const INPUT_CLASS =
  'w-full min-h-[60px] rounded-[18px] border border-[rgba(18,36,79,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,255,0.94))] px-4 pb-[14px] pt-[18px] text-brand-navy font-[inherit] caret-brand-blue shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_12px_24px_rgba(23,44,113,0.05)] transition-all duration-[160ms] placeholder:text-[rgba(94,103,130,0.76)] focus:outline-none focus:border-[rgba(20,150,243,0.45)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(20,150,243,0.12),0_16px_28px_rgba(23,44,113,0.1)]';

export function DatePickerField({
  id,
  name,
  label,
  showInputLabel = true,
  value,
  onChange,
  minYear = 1950,
  maxDate,
  hint,
  className,
  ariaInvalid,
  ariaDescribedBy,
  disabled = false,
}: DatePickerFieldProps) {
  const effectiveMax = maxDate ?? new Date();
  const maxYear = effectiveMax.getFullYear();
  const selectedDate = parseDobDisplay(value);

  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    if (selectedDate) return startOfMonth(selectedDate);
    return defaultDobMonth();
  });

  // Portal popover position state
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);

  // Mark as client-mounted so the portal can be created
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync visible month when value is parsed externally (e.g. restored from store)
  useEffect(() => {
    if (selectedDate) setVisibleMonth(startOfMonth(selectedDate));
    // Only run when the parsed date identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Compute popover position relative to the input when opening
  useEffect(() => {
    if (!isOpen || !inputWrapRef.current) return;

    function computePosition() {
      if (!inputWrapRef.current) return;
      const rect = inputWrapRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(360, window.innerWidth - 24);
      // Default: below the input, aligned to left edge
      let left = rect.left + window.scrollX;
      const top = rect.bottom + window.scrollY + 10;

      // Clamp so it doesn't overflow the right edge of the viewport
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;

      setPopoverStyle({
        position: 'absolute',
        top,
        left,
        width: popoverWidth,
        zIndex: 9999,
      });
    }

    computePosition();

    // Recompute on resize/scroll
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
  }, [isOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      // Close if click is outside both the wrapper and the portal popover
      const target = e.target as Node;
      const insideWrapper = wrapperRef.current?.contains(target);
      const insidePortal = document
        .getElementById('mc-datepicker-portal')
        ?.contains(target);
      if (!insideWrapper && !insidePortal) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const next = formatDobInput(e.target.value);
    onChange(next);
    const parsed = parseDobDisplay(next);
    if (parsed && parsed <= effectiveMax) setVisibleMonth(startOfMonth(parsed));
  }

  function toggleCalendar() {
    if (disabled) return;
    if (isOpen) { setIsOpen(false); return; }
    if (selectedDate) setVisibleMonth(startOfMonth(selectedDate));
    setIsOpen(true);
  }

  function selectDate(date: Date) {
    if (date > effectiveMax) return;
    onChange(formatDateDisplay(date));
    setVisibleMonth(startOfMonth(date));
    setIsOpen(false);
  }

  const today = new Date();
  const yearOptions = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => maxYear - i,
  );
  const calendarDays = getCalendarDays(visibleMonth);

  /* ── Calendar popover markup (rendered in portal) ───────────────────────── */
  const calendarPopover = (
    <div id="mc-datepicker-portal" style={popoverStyle}>
      <div className="relative overflow-hidden rounded-[30px] border border-[rgba(255,255,255,0.82)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,247,255,0.92))] p-[18px] shadow-[0_28px_58px_rgba(23,44,113,0.18)] backdrop-blur-[18px] animate-calendar-in sm:p-[22px]">
        <div className="relative grid gap-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-2">
              <span className="block text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-brand-blue">
                {label}
              </span>
              <strong className="block text-[1.12rem] tracking-[-0.04em] text-brand-navy">
                {selectedDate ? formatDateDisplay(selectedDate) : 'Select a date'}
              </strong>
            </div>
            {selectedDate && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.86)] bg-[rgba(255,255,255,0.72)] px-3.5 py-2 text-[0.78rem] font-extrabold text-brand-navy shadow-[0_10px_18px_rgba(23,44,113,0.08)] transition-all duration-[180ms] hover:-translate-y-px hover:text-brand-blue"
                onClick={() => onChange('')}
              >
                Clear
              </button>
            )}
          </div>

          {/* Month / Year selects */}
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="relative min-w-0">
              <select
                className="h-11 w-full appearance-none rounded-[16px] border border-[rgba(255,255,255,0.86)] bg-[rgba(255,255,255,0.8)] px-3 pr-8 text-[0.9rem] font-extrabold text-brand-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_10px_18px_rgba(23,44,113,0.06)] outline-none sm:px-4 sm:pr-10 sm:text-[0.92rem]"
                value={visibleMonth.getMonth()}
                onChange={(e) =>
                  setVisibleMonth(new Date(visibleMonth.getFullYear(), Number(e.target.value), 1))
                }
              >
                {MONTH_LABELS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[rgba(20,150,243,0.84)]">
                <span className="rotate-90"><ChevronDownIcon /></span>
              </span>
            </div>
            <div className="relative min-w-0">
              <select
                className="h-11 w-full appearance-none rounded-[16px] border border-[rgba(255,255,255,0.86)] bg-[rgba(255,255,255,0.8)] px-3 pr-8 text-[0.9rem] font-extrabold text-brand-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_10px_18px_rgba(23,44,113,0.06)] outline-none sm:px-4 sm:pr-10 sm:text-[0.92rem]"
                value={visibleMonth.getFullYear()}
                onChange={(e) =>
                  setVisibleMonth(new Date(Number(e.target.value), visibleMonth.getMonth(), 1))
                }
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[rgba(20,150,243,0.84)]">
                <span className="rotate-90"><ChevronDownIcon /></span>
              </span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid gap-3 rounded-[24px] border border-[rgba(255,255,255,0.72)] bg-[rgba(247,250,255,0.56)] p-3">
            {/* Weekday headers */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
              {WEEKDAY_LABELS.map((wd) => (
                <span
                  key={wd}
                  className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.8)] bg-[rgba(255,255,255,0.72)] text-center text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-[rgba(23,44,113,0.62)]"
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
              {calendarDays.map(({ date, isCurrentMonth }) => {
                const isSelected =
                  selectedDate !== null &&
                  date.getFullYear() === selectedDate.getFullYear() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getDate() === selectedDate.getDate();
                const isToday =
                  date.getFullYear() === today.getFullYear() &&
                  date.getMonth() === today.getMonth() &&
                  date.getDate() === today.getDate();
                const isDisabled = date > effectiveMax;

                return (
                  <button
                    key={`${date.toISOString()}-${isCurrentMonth}`}
                    type="button"
                    disabled={isDisabled}
                    className={cn(
                      'relative inline-flex aspect-square w-full items-center justify-center overflow-hidden rounded-[16px] border text-[0.92rem] font-extrabold transition-all duration-[180ms]',
                      isSelected
                        ? 'border-[rgba(15,60,150,0.08)] bg-[linear-gradient(135deg,#1496f3,#172c71)] text-white shadow-[0_16px_28px_rgba(23,44,113,0.24)]'
                        : isToday
                        ? 'border-[rgba(255,197,25,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,246,215,0.94))] text-brand-navy'
                        : isDisabled
                        ? 'border-[rgba(18,36,79,0.05)] bg-[rgba(244,248,255,0.62)] text-[rgba(94,103,130,0.38)] cursor-not-allowed'
                        : !isCurrentMonth
                        ? 'border-[rgba(18,36,79,0.05)] bg-[rgba(244,248,255,0.62)] text-[rgba(94,103,130,0.5)]'
                        : 'border-[rgba(255,255,255,0.84)] bg-[rgba(255,255,255,0.88)] text-brand-navy hover:-translate-y-px',
                    )}
                    onClick={() => selectDate(date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>

        {showInputLabel ? <span className={LABEL_CLASS}>{label}</span> : null}
        <div className="relative" ref={inputWrapRef}>
          <input
            className={cn(INPUT_CLASS, 'pr-[56px]', disabled && 'cursor-not-allowed bg-slate-50 text-slate-600')}
            id={id}
            name={name}
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="DD/MM/YYYY"
            maxLength={10}
            value={value}
            onChange={handleInputChange}
            readOnly={disabled}
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
          />
          <button
            type="button"
            disabled={disabled}
            className="absolute top-1/2 right-3 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-[12px] border-0 bg-[rgba(20,150,243,0.08)] text-brand-navy cursor-pointer transition-all duration-[180ms] hover:-translate-y-[calc(50%+1px)] hover:bg-[rgba(255,197,25,0.16)] hover:shadow-[0_10px_20px_rgba(23,44,113,0.08)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-[-50%] disabled:hover:bg-[rgba(20,150,243,0.08)] disabled:hover:shadow-none"
            aria-label={isOpen ? 'Hide calendar' : 'Show calendar'}
            aria-expanded={isOpen}
            onClick={toggleCalendar}
          >
            <CalendarIcon />
          </button>
        </div>
        <span className="text-[0.82rem] leading-[1.55] text-brand-muted">
          {hint ?? (selectedDate ? `Selected: ${formatDateDisplay(selectedDate)}` : 'Use the calendar or type DD/MM/YYYY.')}
        </span>

      {/* Render the popover in a portal so it escapes all parent overflow/z-index constraints */}
      {isOpen && mounted && createPortal(calendarPopover, document.body)}
    </div>
  );
}
