'use client';

import { type ReactNode } from 'react';
import { CustomerJourneyTimeline } from '@/components/shared/customer-journey-timeline';
import { LosStatusPill, losStatusPillStyles } from '@/components/shared/los-status-pill';
import { isWorkspaceRecordRejected, isWorkspaceRecordInternalError } from '@/lib/workspace-alert';
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
  if (c === 'INTERNAL_ERROR' || c === 'IN_REVIEW') return '#f59e0b';
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

function ContactChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(23,44,113,0.1)] bg-white px-2.5 py-1 text-[0.74rem] font-semibold text-brand-text">
      {children}
    </span>
  );
}

function HighlightStat({
  label,
  value,
  valueClassName = 'text-brand-navy',
  accent,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  accent?: string;
}) {
  return (
    <div
      className="min-w-[136px] rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white px-4 py-3 shadow-[0_1px_10px_rgba(23,44,113,0.07)]"
      style={accent ? { borderColor: `${accent}33`, background: `linear-gradient(180deg, white, ${accent}08)` } : undefined}
    >
      <p className="m-0 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{label}</p>
      <p className={`m-0 mt-1.5 text-[1.35rem] font-extrabold leading-none tracking-[-0.03em] ${valueClassName}`}>{value}</p>
    </div>
  );
}

export function WorkspaceRecordHeader({
  eyebrow, title, mobile, email, statusCode, statusLabel, sourceLabel,
  rejectionReason, alertText, createdAt, updatedAt,
  createdLabel = 'Created', updatedLabel = 'Updated',
  quickStats, highlights, recordIds, journeyTitle, journeySubtitle, journeySteps, trailing,
}: {
  eyebrow: string; title: string; mobile: string; email?: string | null;
  statusCode: string; statusLabel: string; sourceLabel: string;
  rejectionReason?: string | null;
  /** Pre-filtered failure/warning text (see `buildWorkspaceAlertText`). */
  alertText?: string | null;
  createdAt: string; updatedAt: string; createdLabel?: string; updatedLabel?: string;
  quickStats?: Array<{ label: string; value: ReactNode }>;
  /** Prominent summary stats shown beside the applicant block (e.g. CIBIL score, loan amount). */
  highlights?: Array<{ label: string; value: ReactNode; valueClassName?: string; accent?: string }>;
  /** Shown between applicant details and opened/updated metadata. */
  recordIds?: ReactNode;
  journeyTitle?: string; journeySubtitle?: string; journeySteps?: JourneyStep[];
  trailing?: ReactNode;
}) {
  const accent = statusAccentColor(statusCode);
  const pillStyle = losStatusPillStyles(statusCode);
  const isRejected = isWorkspaceRecordRejected(statusCode, rejectionReason);
  const isInternalError = isWorkspaceRecordInternalError(statusCode);
  const bannerText = alertText?.trim() || null;

  return (
    <header
      className="overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.1)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.99),rgba(239,247,255,0.96))' }}
    >
      {/* Top accent bar */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg,${accent},${accent}44)` }} aria-hidden />

      <div className="px-4 py-3">
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] text-[0.82rem] font-extrabold text-white"
              style={{ background: `linear-gradient(135deg,${accent},${accent}bb)` }}
              aria-hidden
            >
              {getInitials(title)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{eyebrow}</span>
                <LosStatusPill code={statusCode} label={statusLabel} />
              </div>
              <h1 className="m-0 text-[1.2rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-navy">
                {title}
              </h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <ContactChip>{mobile}</ContactChip>
                {email?.trim() ? <ContactChip>{email}</ContactChip> : null}
                <ContactChip>{sourceLabel}</ContactChip>
              </div>
            </div>
          </div>

          {highlights && highlights.length > 0 ? (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {highlights.map((item) => (
                <HighlightStat
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  valueClassName={item.valueClassName}
                  accent={item.accent}
                />
              ))}
            </div>
          ) : null}

          {trailing ? <div className="flex flex-wrap gap-2 xl:justify-end">{trailing}</div> : null}
        </div>

        {(recordIds || quickStats?.length) ? (
          <div className="mt-3 grid gap-3 border-t border-[rgba(23,44,113,0.07)] pt-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
            {recordIds}
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[10px] border border-[rgba(23,44,113,0.09)] bg-[rgba(248,250,255,0.6)] px-3 py-2.5 sm:grid-cols-3">
              <Chip label={createdLabel} value={createdAt} />
              <Chip label={updatedLabel} value={updatedAt} />
              {quickStats?.map((s) => <Chip key={s.label} label={s.label} value={s.value} />)}
            </dl>
          </div>
        ) : (
          <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-[10px] border border-[rgba(23,44,113,0.09)] bg-[rgba(248,250,255,0.6)] px-3 py-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <Chip label={createdLabel} value={createdAt} />
            <Chip label={updatedLabel} value={updatedAt} />
            {quickStats?.map((s) => <Chip key={s.label} label={s.label} value={s.value} />)}
          </dl>
        )}
      </div>

      {/* Alert */}
      {bannerText ? (
        <div
          className="mx-4 mb-3 flex items-start gap-2 rounded-[8px] border px-3 py-2 text-[0.78rem] leading-snug"
          style={isRejected
            ? { borderColor: `${pillStyle.text}33`, backgroundColor: pillStyle.bg, color: pillStyle.text }
            : isInternalError
              ? { borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(255,251,235,0.95)', color: '#92400e' }
            : { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(255,251,235,0.9)', color: '#92400e' }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span>{bannerText}</span>
        </div>
      ) : null}

      {/* Journey timeline */}
      {journeySteps && journeySteps.length > 0 && journeyTitle ? (
        <CustomerJourneyTimeline embedded title={journeyTitle} subtitle={journeySubtitle} steps={journeySteps} />
      ) : null}
    </header>
  );
}
