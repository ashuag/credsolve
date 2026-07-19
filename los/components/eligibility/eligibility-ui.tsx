'use client';

import { ReactNode, useEffect } from 'react';
import { cx } from '@/lib/cx';

// Re-exported from canonical homes so existing importers continue to work.
// Prefer importing directly from `@/lib/auth` / `@/lib/cx` in new code.
export { getLosToken } from '@/lib/auth';
export { cx };

function statusBadge(isActive: boolean) {
  return isActive
    ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]'
    : 'bg-[rgba(239,68,68,0.1)] text-[#991b1b]';
}

export function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[6px] rounded-full px-3 py-1 text-[0.78rem] font-extrabold',
        statusBadge(isActive),
      )}
    >
      <span className={cx('h-[7px] w-[7px] rounded-full', isActive ? 'bg-[#22c55e]' : 'bg-[#ef4444]')} aria-hidden />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export function IconButton({
  title,
  onClick,
  disabled = false,
  tone = 'default',
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'success';
  children: ReactNode;
}) {
  const toneClass = tone === 'danger'
    ? 'border-[rgba(239,68,68,0.16)] text-[#9f1c1c] hover:border-[rgba(239,68,68,0.3)]'
    : tone === 'success'
      ? 'border-[rgba(34,197,94,0.18)] text-[#166534] hover:border-[rgba(34,197,94,0.32)]'
      : 'border-[rgba(23,44,113,0.12)] text-brand-navy hover:border-[rgba(20,150,243,0.24)]';

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] bg-[rgba(255,255,255,0.92)] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        toneClass,
      )}
    >
      {children}
      <span className="sr-only">{title}</span>
    </button>
  );
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,66,0.42)] p-4 backdrop-blur-[4px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[520px] rounded-[20px] border border-[rgba(23,44,113,0.12)] p-6 shadow-[0_28px_70px_rgba(23,44,113,0.22)]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,247,255,0.96))' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-brand-blue">
              Eligibility Criteria
            </span>
            <h2 className="m-0 text-[1.3rem] font-extrabold leading-[1.1] tracking-[-0.04em]">
              {title}
            </h2>
            <p className="m-0 mt-1 text-[0.85rem] leading-[1.4] text-brand-muted">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy"
            aria-label="Close"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SummaryCards({ total, active, inactive }: { total: number; active: number; inactive: number }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {[
        { label: 'Total', value: total },
        { label: 'Active', value: active },
        { label: 'Inactive', value: inactive },
      ].map((item) => (
        <article
          key={item.label}
          className="rounded-[10px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">{item.label}</span>
          <strong className="mt-0.5 block text-[1.55rem] font-extrabold leading-none tracking-[-0.03em]">
            {item.value}
          </strong>
        </article>
      ))}
    </div>
  );
}
