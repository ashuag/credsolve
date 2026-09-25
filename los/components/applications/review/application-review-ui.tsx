'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import type { KycMatchVerdict } from '@/lib/kyc-field-match';

export function ReviewCard({
  icon,
  title,
  right,
  children,
  iconTone,
}: {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  iconTone?: 'ok' | 'warn' | 'default';
}) {
  const iconStyle =
    iconTone === 'ok'
      ? { background: 'var(--ok-bg)', color: 'var(--ok)' }
      : iconTone === 'warn'
        ? { background: 'var(--warn-bg)', color: 'var(--warn)' }
        : undefined;

  return (
    <section className="card">
      <div className="card-h">
        <span className="ico" style={iconStyle}>
          {icon}
        </span>
        <h3>{title}</h3>
        {right ? <div className="right">{right}</div> : null}
      </div>
      <div className="card-b">{children}</div>
    </section>
  );
}

export function ReviewField({
  label,
  value,
  sub,
  tone,
  badge,
  badgeInValue: _badgeInValue = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'flag' | 'accent';
  badge?: ReactNode;
  badgeInValue?: boolean;
}) {
  const isEmpty = value === '—' || value === null || value === undefined || value === '';
  const valueNode = isEmpty ? '—' : value;

  return (
    <div className={`field${tone ? ` ${tone}` : ''}${badge ? ' has-badge' : ''}`}>
      <div className="lab">
        <span className="lab-text">{label}</span>
        {badge}
      </div>
      <div className={`val${isEmpty ? ' empty' : ''}`}>{valueNode}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function ReviewPill({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'ok' | 'warn' | 'info';
}) {
  return (
    <span className={`pill pill-${tone}`}>
      <span className="pdot" />
      {children}
    </span>
  );
}

export function ReviewSectionLabel({ children, first }: { children: ReactNode; first?: boolean }) {
  return <div className={`sec-label${first ? ' first' : ''}`}>{children}</div>;
}

export function ReviewMatchBadge({
  verdict,
  score,
  title,
}: {
  verdict: KycMatchVerdict;
  score?: number;
  title?: string;
}) {
  const base =
    verdict === 'partial'
      ? 'Partial'
      : verdict === 'match'
        ? 'Match'
        : verdict === 'mismatch'
          ? 'Mismatch'
          : 'N/A';
  const label = verdict !== 'missing' && score != null ? `${base} ${score}%` : base;
  const display = verdict === 'mismatch' ? `✕ ${label}` : label;

  return (
    <span className={`match-badge ${verdict}`} title={title}>
      {display}
    </span>
  );
}

export function MaskedSecret({
  value,
  mask,
  mono = true,
}: {
  value: string;
  mask: string;
  mono?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  if (!value?.trim()) return <span className="val empty">—</span>;

  return (
    <span className={`secret${mono ? ' mono' : ''}`}>
      <span>{revealed ? value : mask}</span>
      <button
        type="button"
        className="eye"
        aria-label={revealed ? 'Hide' : 'Reveal'}
        onClick={() => setRevealed((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </button>
    </span>
  );
}

export function CopyUuidButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={`copy${done ? ' done' : ''}`}
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

export function ReviewEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="empty-state">
      <div className="es-t">{title}</div>
      <div className="es-s">{subtitle}</div>
    </div>
  );
}

export function ApplicationReviewToolbar({
  onRefresh,
  onReject,
  rejectDisabled = false,
  onApproveNameMatch,
  approveNameMatchBusy = false,
  onApproveAadhaarName,
  approveAadhaarNameBusy = false,
  onApprove,
  approveDisabled = false,
  approveBusy = false,
  onDisburse,
  disburseDisabled = false,
  disburseBusy = false,
}: {
  onRefresh: () => void;
  onReject?: () => void;
  rejectDisabled?: boolean;
  onApproveNameMatch?: () => void;
  approveNameMatchBusy?: boolean;
  onApproveAadhaarName?: () => void;
  approveAadhaarNameBusy?: boolean;
  onApprove?: () => void;
  approveDisabled?: boolean;
  approveBusy?: boolean;
  onDisburse?: () => void;
  disburseDisabled?: boolean;
  disburseBusy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onReject ? (
        <button
          type="button"
          onClick={onReject}
          disabled={rejectDisabled}
          className="min-h-[38px] rounded-[8px] border border-[rgba(239,68,68,0.35)] bg-white px-4 text-[0.82rem] font-bold text-[#dc2626] hover:bg-[rgba(254,242,242,0.9)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          Reject application
        </button>
      ) : null}
      {onApproveNameMatch ? (
        <button
          type="button"
          onClick={onApproveNameMatch}
          disabled={approveNameMatchBusy}
          className="min-h-[38px] rounded-[8px] border border-[rgba(245,158,11,0.45)] bg-[#fffbeb] px-4 text-[0.82rem] font-bold text-[#92400e] hover:bg-[#fef3c7] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {approveNameMatchBusy ? 'Approving…' : 'Approve'}
        </button>
      ) : null}
      {onApproveAadhaarName ? (
        <button
          type="button"
          onClick={onApproveAadhaarName}
          disabled={approveAadhaarNameBusy}
          className="min-h-[38px] rounded-[8px] border border-[rgba(16,185,129,0.35)] bg-[#ecfdf5] px-4 text-[0.82rem] font-bold text-[#047857] hover:bg-[#d1fae5] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {approveAadhaarNameBusy ? 'Approving…' : 'Approve application'}
        </button>
      ) : null}
      {onApprove ? (
        <button
          type="button"
          onClick={onApprove}
          disabled={approveDisabled || approveBusy}
          className="min-h-[38px] rounded-[8px] border border-[rgba(16,185,129,0.35)] bg-[#ecfdf5] px-4 text-[0.82rem] font-bold text-[#047857] hover:bg-[#d1fae5] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {approveBusy ? 'Approving…' : 'Approve'}
        </button>
      ) : null}
      {onDisburse ? (
        <button
          type="button"
          onClick={onDisburse}
          disabled={disburseDisabled || disburseBusy}
          className="min-h-[38px] rounded-[8px] bg-[#0F2748] px-4 text-[0.82rem] font-bold text-[#4ADE80] hover:bg-[#0F2748] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {disburseBusy ? 'Disbursing…' : 'Disburse'}
        </button>
      ) : null}
      <button type="button" onClick={onRefresh} className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]">
        Refresh data
      </button>
    </div>
  );
}
