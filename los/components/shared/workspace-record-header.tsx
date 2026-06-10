'use client';

import { type ReactNode } from 'react';
import { CustomerJourneyTimeline } from '@/components/shared/customer-journey-timeline';
import { LosStatusPill, losStatusPillStyles } from '@/components/shared/los-status-pill';
import type { JourneyStep } from '@/lib/customer-journey';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function statusAccentColor(code: string): string {
  const c = code.toUpperCase();
  if (c.includes('REJECT') || c.includes('FAIL') || c.includes('DECLIN')) return '#ef4444';
  if (c === 'CONVERTED' || c.includes('APPROV') || c.includes('DISBURS')) return '#10b981';
  if (c === 'NEW' || c === 'IN_PROGRESS' || c === 'DRAFT') return '#1496f3';
  return '#6366f1';
}

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.1em]" style={{ color: 'rgba(94,103,130,0.65)' }}>{label}</dt>
      <dd className="m-0 text-[0.8rem] font-bold text-brand-text leading-tight">{value}</dd>
    </div>
  );
}

export function WorkspaceRecordHeader({
  eyebrow, title, mobile, email, statusCode, statusLabel, sourceLabel,
  rejectionReason, note, secondaryNote, createdAt, updatedAt,
  createdLabel = 'Created', updatedLabel = 'Updated',
  quickStats, journeyTitle, journeySubtitle, journeySteps, trailing,
}: {
  eyebrow: string; title: string; mobile: string; email?: string | null;
  statusCode: string; statusLabel: string; sourceLabel: string;
  rejectionReason?: string | null; note?: string | null; secondaryNote?: string | null;
  createdAt: string; updatedAt: string; createdLabel?: string; updatedLabel?: string;
  quickStats?: Array<{ label: string; value: ReactNode }>;
  journeyTitle?: string; journeySubtitle?: string; journeySteps?: JourneyStep[];
  trailing?: ReactNode;
}) {
  const accent = statusAccentColor(statusCode);
  const pillStyle = losStatusPillStyles(statusCode);
  const isRejected = statusCode.toUpperCase().includes('REJECT') || Boolean(rejectionReason);
  const alertText = [rejectionReason, note, secondaryNote ? `Bureau: ${secondaryNote}` : null].filter(Boolean).join(' · ');

  return (
    <header
      className="overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.1)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.99),rgba(239,247,255,0.96))' }}
    >
      {/* Top accent bar */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg,${accent},${accent}44)` }} aria-hidden />

      {/* Main row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[11px] text-[0.8rem] font-extrabold text-white"
          style={{ background: `linear-gradient(135deg,${accent},${accent}bb)` }}
          aria-hidden
        >
          {getInitials(title)}
        </div>

        {/* Name + identifiers */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{eyebrow}</span>
            <LosStatusPill code={statusCode} label={statusLabel} />
          </div>
          <h1 className="m-0 text-[1.1rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-navy">
            {title}
          </h1>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[0.78rem] text-brand-muted">
            <span className="font-bold text-brand-text">{mobile}</span>
            {email?.trim() && <span>{email}</span>}
            <span>{sourceLabel}</span>
          </div>
        </div>

        {/* Meta grid */}
        <dl className="m-0 flex-shrink-0 grid grid-cols-2 gap-x-5 gap-y-2 rounded-[10px] border border-[rgba(23,44,113,0.09)] bg-[rgba(248,250,255,0.6)] px-3 py-2.5">
          <Chip label={createdLabel} value={createdAt} />
          <Chip label={updatedLabel} value={updatedAt} />
          {quickStats?.map((s) => <Chip key={s.label} label={s.label} value={s.value} />)}
        </dl>

        {/* Trailing (KYC photos) */}
        {trailing}
      </div>

      {/* Alert */}
      {alertText ? (
        <div
          className="mx-4 mb-3 flex items-start gap-2 rounded-[8px] border px-3 py-2 text-[0.78rem] leading-snug"
          style={isRejected
            ? { borderColor: `${pillStyle.text}33`, backgroundColor: pillStyle.bg, color: pillStyle.text }
            : { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(255,251,235,0.9)', color: '#92400e' }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span>{alertText}</span>
        </div>
      ) : null}

      {/* Journey timeline */}
      {journeySteps && journeySteps.length > 0 && journeyTitle ? (
        <CustomerJourneyTimeline embedded title={journeyTitle} subtitle={journeySubtitle} steps={journeySteps} />
      ) : null}
    </header>
  );
}
