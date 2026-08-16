'use client';

import Link from 'next/link';
import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  DataTableStatusPill,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  LOS_LEAD_SOURCE_TYPES,
  createBank,
  createCity,
  createGender,
  createLeadSource,
  createOccupation,
  createReasonForLoan,
  createRepaymentDueDate,
  createState,
  deleteBank,
  getMasters,
  type LosCityMaster,
  type LosLeadSourceMaster,
  type LosLeadSourceType,
  type LosMastersPayload,
  type LosNamedMaster,
  type LosRepaymentDueDateMaster,
  type LosStateMaster,
  type LosStatusMaster,
  updateApplicationStatus,
  updateBank,
  updateCity,
  updateGender,
  updateLeadSource,
  updateLeadStatus,
  updateOccupation,
  updateReasonForLoan,
  updateRepaymentDueDate,
  updateState,
} from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getMasterDefinition, type MasterSlug } from './master-definitions';

type ModalState =
  | { kind: 'leadStatus'; item: LosStatusMaster }
  | { kind: 'applicationStatus'; item: LosStatusMaster }
  | { kind: 'leadSource'; item?: LosLeadSourceMaster }
  | { kind: 'state'; item?: LosStateMaster }
  | { kind: 'city'; item?: LosCityMaster }
  | { kind: 'occupation'; item?: LosNamedMaster }
  | { kind: 'reasonForLoan'; item?: LosNamedMaster }
  | { kind: 'gender'; item?: LosNamedMaster }
  | { kind: 'bank'; item?: LosNamedMaster }
  | { kind: 'dueDate'; item?: LosRepaymentDueDateMaster };

function formatLeadSourceType(type: LosLeadSourceType) {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const StatusPill = DataTableStatusPill;


function IconButton({
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

function ModalShell({
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
        className="w-full max-w-[460px] rounded-[20px] border border-[rgba(23,44,113,0.12)] p-6 shadow-[0_28px_70px_rgba(23,44,113,0.22)]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,247,255,0.96))' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-brand-blue">
              LOS Masters
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

function StatusModal({
  label,
  item,
  onClose,
  onSubmit,
}: {
  label: string;
  item: LosStatusMaster;
  onClose: () => void;
  onSubmit: (displayName: string) => Promise<unknown>;
}) {
  const [displayName, setDisplayName] = useState(item.displayName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(displayName);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Edit ${label}`} subtitle={`The internal code stays ${item.code}. Only the LOS display label is editable.`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">System code</span>
          <input className="los-input bg-[rgba(248,250,255,0.8)]" value={item.code} readOnly />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Display label</span>
          <input
            className="los-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={50}
            required
          />
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Save Label'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function LeadSourceModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: LosLeadSourceMaster;
  onClose: () => void;
  onSubmit: (payload: { name: string; type: LosLeadSourceType }) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<LosLeadSourceType>(initial?.type ?? 'ADS');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, type });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save lead source.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={initial ? 'Edit Lead Source' : 'Add Lead Source'} subtitle="Configure the source name and source type used across LOS lead intake." onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Source name</span>
          <input className="los-input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={50} required />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Source type</span>
          <select className="los-input" value={type} onChange={(event) => setType(event.target.value as LosLeadSourceType)}>
            {LOS_LEAD_SOURCE_TYPES.map((option) => (
              <option key={option} value={option}>
                {formatLeadSourceType(option)}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Source'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function StateModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: LosStateMaster;
  onClose: () => void;
  onSubmit: (payload: { name: string; code: string }) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, code });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save state.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={initial ? 'Edit State' : 'Add State'} subtitle="Manage state labels and short codes for location masters." onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">State name</span>
          <input className="los-input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Code</span>
          <input className="los-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} minLength={2} maxLength={5} required />
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add State'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CityModal({
  initial,
  states,
  onClose,
  onSubmit,
}: {
  initial?: LosCityMaster;
  states: LosStateMaster[];
  onClose: () => void;
  onSubmit: (payload: { name: string; stateId: number }) => Promise<unknown>;
}) {
  const selectableStates = useMemo(
    () => states.filter((state) => state.isActive || state.id === initial?.stateId),
    [initial?.stateId, states],
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [stateId, setStateId] = useState<number>(initial?.stateId ?? selectableStates[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stateId) {
      setError('Select a state.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, stateId });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save city.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={initial ? 'Edit City' : 'Add City'} subtitle="Map each city to a state so customer and LOS flows stay aligned." onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">City name</span>
          <input className="los-input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">State</span>
          <select className="los-input" value={stateId || ''} onChange={(event) => setStateId(Number(event.target.value))}>
            {selectableStates.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name} ({state.code}){state.isActive ? '' : ' - Inactive'}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add City'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function formatDueMonth(year: number, month: number) {
  return `${MONTH_LABELS[month - 1]?.slice(0, 3) ?? month} ${year}`;
}

function lastIsoDateOfMonth(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function formatIsoDisplay(iso: string) {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day} ${MONTH_LABELS[Number(month) - 1]?.slice(0, 3) ?? month} ${year}`;
}

function DueDateModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: LosRepaymentDueDateMaster;
  onClose: () => void;
  onSubmit: (payload: { year: number; month: number; dueDate: string }) => Promise<unknown>;
}) {
  const now = new Date();
  const [year, setYear] = useState(initial?.year ?? now.getFullYear());
  const [month, setMonth] = useState(initial?.month ?? now.getMonth() + 1);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? lastIsoDateOfMonth(now.getFullYear(), now.getMonth() + 1));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = Boolean(initial);

  function applyMonth(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonth(nextMonth);
    setDueDate((prev) => {
      const day = Number(prev.slice(8, 10)) || 1;
      const last = Number(lastIsoDateOfMonth(nextYear, nextMonth).slice(8, 10));
      return lastIsoDateOfMonth(nextYear, nextMonth).slice(0, 8) + String(Math.min(day, last)).padStart(2, '0');
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ year, month, dueDate });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save due date.');
    } finally {
      setSaving(false);
    }
  }

  const minDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const maxDate = lastIsoDateOfMonth(year, month);

  return (
    <ModalShell
      title={initial ? 'Edit Due Date' : 'Add Due Date'}
      subtitle="When this month still has this due date ahead (or today), new applications use it instead of rolling to next month-end."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Year</span>
          <input
            className="los-input"
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(event) => applyMonth(Number(event.target.value), month)}
            disabled={locked}
            required
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Month</span>
          <select
            className="los-input"
            value={month}
            onChange={(event) => applyMonth(year, Number(event.target.value))}
            disabled={locked}
            required
          >
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Due date</span>
          <input
            className="los-input"
            type="date"
            min={minDate}
            max={maxDate}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Due Date'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function NamedMasterModal({
  noun,
  initial,
  subtitle,
  maxLength = 100,
  onClose,
  onSubmit,
}: {
  noun: string;
  initial?: LosNamedMaster;
  subtitle?: string;
  maxLength?: number;
  onClose: () => void;
  onSubmit: (payload: { name: string }) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Unable to save ${noun.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={initial ? `Edit ${noun}` : `Add ${noun}`}
      subtitle={subtitle ?? `Configure ${noun.toLowerCase()} values available in the onboarding and LOS flows.`}
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">{noun} name</span>
          <input className="los-input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={maxLength} required />
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : initial ? 'Save Changes' : `Add ${noun}`}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function MasterSection({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">{title}</h2>
          <p className="m-0 mt-1 max-w-[62ch] text-[0.86rem] leading-[1.5] text-brand-muted">
            {description}
          </p>
        </div>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="los-btn-primary whitespace-nowrap">
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SummaryCards({ total, active, inactive }: { total: number; active: number; inactive: number }) {
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

const EditIcon = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeactivateIcon = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const ActivateIcon = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

function ToggleActions({
  busy,
  isActive,
  editTitle,
  onEdit,
  activateTitle,
  deactivateTitle,
  onToggle,
  extra,
}: {
  busy: boolean;
  isActive: boolean;
  editTitle: string;
  onEdit: () => void;
  activateTitle: string;
  deactivateTitle: string;
  onToggle: (nextActive: boolean) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton title={editTitle} onClick={onEdit} disabled={busy}>
        {EditIcon}
      </IconButton>
      {isActive ? (
        <IconButton title={deactivateTitle} tone="danger" disabled={busy} onClick={() => onToggle(false)}>
          {DeactivateIcon}
        </IconButton>
      ) : (
        <IconButton title={activateTitle} tone="success" disabled={busy} onClick={() => onToggle(true)}>
          {ActivateIcon}
        </IconButton>
      )}
      {extra}
    </div>
  );
}

function statusColumn<T extends { isActive: boolean }>(): DataTableColumn<T, 'status'> {
  return {
    key: 'status',
    label: 'Status',
    getFilterValue: (item) => (item.isActive ? 'active' : 'inactive'),
    getSortValue: (item) => (item.isActive ? 0 : 1),
    filter: {
      type: 'select',
      options: [...ACTIVE_INACTIVE_FILTER_OPTIONS],
      matches: (item, value) => matchesActiveInactiveFilter(item.isActive, value),
    },
    render: (item) => <StatusPill isActive={item.isActive} />,
  };
}

export function MasterDetailPanel({ master }: { master: MasterSlug }) {
  const definition = getMasterDefinition(master);
  const [masters, setMasters] = useState<LosMastersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const loadMasters = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return null;
    }

    try {
      const data = await getMasters(token);
      setMasters(data);
      setFetchError(null);
      return data;
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load masters.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  async function runAction<T>(key: string, task: (token: string) => Promise<T>) {
    const token = getLosToken();
    if (!token) {
      setActionError('Session expired - please log in again.');
      throw new Error('Session expired - please log in again.');
    }

    setBusyKey(key);
    setActionError(null);

    try {
      const result = await task(token);
      await loadMasters(token);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSoftToggle(key: string, action: (token: string) => Promise<unknown>, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;
    await runAction(key, action);
  }

  const currentItems = useMemo(() => {
    switch (master) {
      case 'lead-statuses':
        return masters?.leadStatuses ?? [];
      case 'application-statuses':
        return masters?.applicationStatuses ?? [];
      case 'lead-sources':
        return masters?.leadSources ?? [];
      case 'states':
        return masters?.states ?? [];
      case 'cities':
        return masters?.cities ?? [];
      case 'occupations':
        return masters?.occupations ?? [];
      case 'reasons-for-loan':
        return masters?.reasonsForLoan ?? [];
      case 'genders':
        return masters?.genders ?? [];
      case 'banks':
        return masters?.banks ?? [];
      case 'due-dates':
        return masters?.repaymentDueDates ?? [];
      default:
        return [];
    }
  }, [master, masters]);

  const summary = useMemo(() => {
    const total = currentItems.length;
    const active = currentItems.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [currentItems]);

  const leadStatusColumns = useMemo((): DataTableColumn<LosStatusMaster>[] => [
    {
      key: 'code',
      label: 'Code',
      getFilterValue: (item) => item.code,
      getSortValue: (item) => item.code.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search code…' },
      render: (item) => <strong>{item.code}</strong>,
    },
    {
      key: 'displayName',
      label: 'Display label',
      getFilterValue: (item) => item.displayName,
      getSortValue: (item) => item.displayName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search label…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.displayName,
    },
    statusColumn<LosStatusMaster>(),
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <ToggleActions
          busy={busyKey === `lead-status-${item.id}`}
          isActive={item.isActive}
          editTitle="Edit lead status label"
          onEdit={() => setModal({ kind: 'leadStatus', item })}
          activateTitle="Activate lead status"
          deactivateTitle="Deactivate lead status"
          onToggle={(next) => {
            void handleSoftToggle(
              `lead-status-${item.id}`,
              (token) => updateLeadStatus(token, item.id, { isActive: next }),
              `Mark ${item.code} as ${next ? 'active' : 'inactive'}?`,
            );
          }}
        />
      ),
    },
  ], [busyKey]);

  const applicationStatusColumns = useMemo((): DataTableColumn<LosStatusMaster>[] => [
    {
      key: 'code',
      label: 'Code',
      getFilterValue: (item) => item.code,
      getSortValue: (item) => item.code.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search code…' },
      render: (item) => <strong>{item.code}</strong>,
    },
    {
      key: 'displayName',
      label: 'Display label',
      getFilterValue: (item) => item.displayName,
      getSortValue: (item) => item.displayName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search label…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.displayName,
    },
    statusColumn<LosStatusMaster>(),
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <ToggleActions
          busy={busyKey === `application-status-${item.id}`}
          isActive={item.isActive}
          editTitle="Edit application status label"
          onEdit={() => setModal({ kind: 'applicationStatus', item })}
          activateTitle="Activate application status"
          deactivateTitle="Deactivate application status"
          onToggle={(next) => {
            void handleSoftToggle(
              `application-status-${item.id}`,
              (token) => updateApplicationStatus(token, item.id, { isActive: next }),
              `Mark ${item.code} as ${next ? 'active' : 'inactive'}?`,
            );
          }}
        />
      ),
    },
  ], [busyKey]);

  const leadSourceColumns = useMemo((): DataTableColumn<LosLeadSourceMaster>[] => [
    {
      key: 'name',
      label: 'Name',
      getFilterValue: (item) => item.name,
      getSortValue: (item) => item.name.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (item) => <strong>{item.name}</strong>,
    },
    {
      key: 'type',
      label: 'Type',
      getFilterValue: (item) => item.type,
      getSortValue: (item) => item.type.toLowerCase(),
      filter: {
        type: 'select',
        options: LOS_LEAD_SOURCE_TYPES.map((type) => ({ value: type, label: formatLeadSourceType(type) })),
        matches: (item, value) => item.type === value,
      },
      cellClassName: 'text-brand-muted',
      render: (item) => formatLeadSourceType(item.type),
    },
    statusColumn<LosLeadSourceMaster>(),
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <ToggleActions
          busy={busyKey === `lead-source-${item.id}`}
          isActive={item.isActive}
          editTitle="Edit lead source"
          onEdit={() => setModal({ kind: 'leadSource', item })}
          activateTitle="Activate lead source"
          deactivateTitle="Deactivate lead source"
          onToggle={(next) => {
            void handleSoftToggle(
              `lead-source-${item.id}`,
              (token) => updateLeadSource(token, item.id, { isActive: next }),
              `Mark ${item.name} as ${next ? 'active' : 'inactive'}?`,
            );
          }}
        />
      ),
    },
  ], [busyKey]);

  const stateColumns = useMemo((): DataTableColumn<LosStateMaster>[] => [
    {
      key: 'name',
      label: 'State',
      getFilterValue: (item) => item.name,
      getSortValue: (item) => item.name.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search state…' },
      render: (item) => <strong>{item.name}</strong>,
    },
    {
      key: 'code',
      label: 'Code',
      getFilterValue: (item) => item.code,
      getSortValue: (item) => item.code.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search code…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.code,
    },
    statusColumn<LosStateMaster>(),
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <ToggleActions
          busy={busyKey === `state-${item.id}`}
          isActive={item.isActive}
          editTitle="Edit state"
          onEdit={() => setModal({ kind: 'state', item })}
          activateTitle="Activate state"
          deactivateTitle="Deactivate state"
          onToggle={(next) => {
            void handleSoftToggle(
              `state-${item.id}`,
              (token) => updateState(token, item.id, { isActive: next }),
              `Mark ${item.name} as ${next ? 'active' : 'inactive'}?`,
            );
          }}
        />
      ),
    },
  ], [busyKey]);

  const cityColumns = useMemo((): DataTableColumn<LosCityMaster>[] => [
    {
      key: 'name',
      label: 'City',
      getFilterValue: (item) => item.name,
      getSortValue: (item) => item.name.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search city…' },
      render: (item) => <strong>{item.name}</strong>,
    },
    {
      key: 'state',
      label: 'State',
      getFilterValue: (item) => `${item.stateName} ${item.stateCode}`,
      getSortValue: (item) => item.stateName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search state…' },
      cellClassName: 'text-brand-muted',
      render: (item) => `${item.stateName} (${item.stateCode})${item.stateIsActive ? '' : ' - Inactive state'}`,
    },
    statusColumn<LosCityMaster>(),
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <ToggleActions
          busy={busyKey === `city-${item.id}`}
          isActive={item.isActive}
          editTitle="Edit city"
          onEdit={() => setModal({ kind: 'city', item })}
          activateTitle="Activate city"
          deactivateTitle="Deactivate city"
          onToggle={(next) => {
            void handleSoftToggle(
              `city-${item.id}`,
              (token) => updateCity(token, item.id, { isActive: next }),
              `Mark ${item.name} as ${next ? 'active' : 'inactive'}?`,
            );
          }}
        />
      ),
    },
  ], [busyKey]);

  function namedColumns(
    noun: string,
    kind: 'occupation' | 'reasonForLoan' | 'gender' | 'bank',
    busyPrefix: string,
    updateFn: (token: string, id: number, data: { isActive: boolean }) => Promise<unknown>,
    withDelete = false,
  ): DataTableColumn<LosNamedMaster>[] {
    return [
      {
        key: 'name',
        label: noun,
        getFilterValue: (item) => item.name,
        getSortValue: (item) => item.name.toLowerCase(),
        filter: { type: 'text', placeholder: `Search ${noun.toLowerCase()}…` },
        render: (item) => <strong>{item.name}</strong>,
      },
      statusColumn<LosNamedMaster>(),
      {
        key: 'actions',
        label: 'Actions',
        sortable: false,
        filter: false,
        render: (item) => (
          <ToggleActions
            busy={busyKey === `${busyPrefix}-${item.id}` || busyKey === `${busyPrefix}-delete-${item.id}`}
            isActive={item.isActive}
            editTitle={`Edit ${noun.toLowerCase()}`}
            onEdit={() => setModal({ kind, item })}
            activateTitle={`Activate ${noun.toLowerCase()}`}
            deactivateTitle={`Deactivate ${noun.toLowerCase()}`}
            onToggle={(next) => {
              void handleSoftToggle(
                `${busyPrefix}-${item.id}`,
                (token) => updateFn(token, item.id, { isActive: next }),
                `Mark ${item.name} as ${next ? 'active' : 'inactive'}?`,
              );
            }}
            extra={
              withDelete ? (
                <IconButton
                  title="Delete bank permanently"
                  tone="danger"
                  disabled={busyKey === `bank-${item.id}` || busyKey === `bank-delete-${item.id}`}
                  onClick={() => {
                    if (!window.confirm(`Permanently delete "${item.name}"? Existing applications that reference this name are unchanged, but the bank will no longer appear in the master list.`)) return;
                    void runAction(`bank-delete-${item.id}`, (token) => deleteBank(token, item.id));
                  }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </IconButton>
              ) : null
            }
          />
        ),
      },
    ];
  }

  const occupationColumns = useMemo(
    () => namedColumns('Occupation', 'occupation', 'occupation', updateOccupation),
    [busyKey],
  );
  const reasonColumns = useMemo(
    () => namedColumns('Reason for Loan', 'reasonForLoan', 'reason-for-loan', updateReasonForLoan),
    [busyKey],
  );
  const genderColumns = useMemo(
    () => namedColumns('Gender', 'gender', 'gender', updateGender),
    [busyKey],
  );
  const bankColumns = useMemo(
    () => namedColumns('Bank', 'bank', 'bank', updateBank, true),
    [busyKey],
  );

  const dueDateColumns = useMemo((): DataTableColumn<LosRepaymentDueDateMaster>[] => [
    {
      key: 'month',
      label: 'Month',
      getFilterValue: (item) => formatDueMonth(item.year, item.month),
      getSortValue: (item) => item.year * 100 + item.month,
      filter: { type: 'text', placeholder: 'Search month…' },
      render: (item) => <strong>{formatDueMonth(item.year, item.month)}</strong>,
    },
    {
      key: 'dueDate',
      label: 'Due date',
      getFilterValue: (item) => item.dueDate,
      getSortValue: (item) => item.dueDate,
      filter: { type: 'text', placeholder: 'Search date…' },
      cellClassName: 'text-brand-muted',
      render: (item) => formatIsoDisplay(item.dueDate),
    },
    statusColumn<LosRepaymentDueDateMaster>(),
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <ToggleActions
          busy={busyKey === `due-date-${item.id}`}
          isActive={item.isActive}
          editTitle="Edit due date"
          onEdit={() => setModal({ kind: 'dueDate', item })}
          activateTitle="Activate due date"
          deactivateTitle="Deactivate due date"
          onToggle={(next) => {
            void handleSoftToggle(
              `due-date-${item.id}`,
              (token) => updateRepaymentDueDate(token, item.id, { isActive: next }),
              `Mark ${formatDueMonth(item.year, item.month)} as ${next ? 'active' : 'inactive'}?`,
            );
          }}
        />
      ),
    },
  ], [busyKey]);

  if (!definition) return null;

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/masters"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.88)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Back to Masters
          </Link>
          <span className="rounded-full border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.84)] px-3 py-1 text-[0.78rem] font-bold text-brand-muted">
            {definition.label}
          </span>
        </div>

        <SummaryCards total={summary.total} active={summary.active} inactive={summary.inactive} />

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {actionError}
          </div>
        ) : null}

        {master === 'lead-statuses' ? (
          <MasterSection title="Lead Status" description="Manage active and inactive lead workflow statuses while keeping the system codes unchanged.">
            <DataTable
              items={masters?.leadStatuses ?? []}
              columns={leadStatusColumns}
              getRowKey={(item) => item.id}
              entityLabel="lead statuses"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No lead statuses available."
              pageSize={20}
            />
          </MasterSection>
        ) : null}

        {master === 'application-statuses' ? (
          <MasterSection title="Application Status" description="Manage active and inactive application stages while keeping the underlying workflow codes fixed.">
            <DataTable
              items={masters?.applicationStatuses ?? []}
              columns={applicationStatusColumns}
              getRowKey={(item) => item.id}
              entityLabel="application statuses"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No application statuses available."
            />
          </MasterSection>
        ) : null}

        {master === 'lead-sources' ? (
          <MasterSection
            title="Lead Sources"
            description="Add, edit, activate, and deactivate lead sources used for attribution and routing."
            actionLabel="+ Add Lead Source"
            onAction={() => setModal({ kind: 'leadSource' })}
          >
            <DataTable
              items={masters?.leadSources ?? []}
              columns={leadSourceColumns}
              getRowKey={(item) => item.id}
              entityLabel="lead sources"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No lead sources available."
            />
          </MasterSection>
        ) : null}

        {master === 'states' ? (
          <MasterSection
            title="States"
            description="Maintain state names, codes, and active state used by location masters."
            actionLabel="+ Add State"
            onAction={() => setModal({ kind: 'state' })}
          >
            <DataTable
              items={masters?.states ?? []}
              columns={stateColumns}
              getRowKey={(item) => item.id}
              entityLabel="states"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No states available."
            />
          </MasterSection>
        ) : null}

        {master === 'cities' ? (
          <MasterSection
            title="Cities"
            description="Manage city names, state mappings, and active state used by onboarding and LOS lookup flows."
            actionLabel="+ Add City"
            onAction={() => setModal({ kind: 'city' })}
          >
            <DataTable
              items={masters?.cities ?? []}
              columns={cityColumns}
              getRowKey={(item) => item.id}
              entityLabel="cities"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No cities available."
              pageSize={10}
            />
          </MasterSection>
        ) : null}

        {master === 'occupations' ? (
          <MasterSection
            title="Occupations"
            description="Manage occupation values shown in customer and LOS forms, including active and inactive options."
            actionLabel="+ Add Occupation"
            onAction={() => setModal({ kind: 'occupation' })}
          >
            <DataTable
              items={masters?.occupations ?? []}
              columns={occupationColumns}
              getRowKey={(item) => item.id}
              entityLabel="occupations"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No occupations available."
            />
          </MasterSection>
        ) : null}

        {master === 'reasons-for-loan' ? (
          <MasterSection
            title="Reason for Loan"
            description="Maintain reason for loan values used across LOS application journeys, including active and inactive options."
            actionLabel="+ Add Reason for Loan"
            onAction={() => setModal({ kind: 'reasonForLoan' })}
          >
            <DataTable
              items={masters?.reasonsForLoan ?? []}
              columns={reasonColumns}
              getRowKey={(item) => item.id}
              entityLabel="reasons for loan"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No reason for loan values available."
            />
          </MasterSection>
        ) : null}

        {master === 'genders' ? (
          <MasterSection
            title="Genders"
            description="Maintain gender options used in onboarding and application details, including active and inactive values."
            actionLabel="+ Add Gender"
            onAction={() => setModal({ kind: 'gender' })}
          >
            <DataTable
              items={masters?.genders ?? []}
              columns={genderColumns}
              getRowKey={(item) => item.id}
              entityLabel="genders"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No genders available."
            />
          </MasterSection>
        ) : null}

        {master === 'banks' ? (
          <MasterSection
            title="Banks"
            description="Manage banks offered in the customer bank-details step. Inactive banks are hidden from the dropdown; delete removes the row permanently."
            actionLabel="+ Add Bank"
            onAction={() => setModal({ kind: 'bank' })}
          >
            <DataTable
              items={masters?.banks ?? []}
              columns={bankColumns}
              getRowKey={(item) => item.id}
              entityLabel="banks"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No banks available."
            />
          </MasterSection>
        ) : null}

        {master === 'due-dates' ? (
          <MasterSection
            title="Due Dates"
            description=""
            actionLabel="+ Add Due Date"
            onAction={() => setModal({ kind: 'dueDate' })}
          >
            <DataTable
              items={masters?.repaymentDueDates ?? []}
              columns={dueDateColumns}
              getRowKey={(item) => item.id}
              entityLabel="due dates"
              loading={loading && !masters}
              error={fetchError}
              onRetry={() => void loadMasters()}
              emptyMessage="No due date overrides yet. Month-end is used until you add one."
            />
          </MasterSection>
        ) : null}
      </div>

      {modal?.kind === 'leadStatus' ? (
        <StatusModal
          label="Lead Status"
          item={modal.item}
          onClose={() => setModal(null)}
          onSubmit={(displayName) => runAction(`lead-status-${modal.item.id}`, (token) => updateLeadStatus(token, modal.item.id, { displayName }))}
        />
      ) : null}

      {modal?.kind === 'applicationStatus' ? (
        <StatusModal
          label="Application Status"
          item={modal.item}
          onClose={() => setModal(null)}
          onSubmit={(displayName) => runAction(`application-status-${modal.item.id}`, (token) => updateApplicationStatus(token, modal.item.id, { displayName }))}
        />
      ) : null}

      {modal?.kind === 'leadSource' ? (() => {
        const item = modal.item;
        return (
          <LeadSourceModal
            initial={item}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`lead-source-${item.id}`, (token) => updateLeadSource(token, item.id, payload))
              : runAction('lead-source-create', (token) => createLeadSource(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'state' ? (() => {
        const item = modal.item;
        return (
          <StateModal
            initial={item}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`state-${item.id}`, (token) => updateState(token, item.id, payload))
              : runAction('state-create', (token) => createState(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'city' ? (() => {
        const item = modal.item;
        return (
          <CityModal
            initial={item}
            states={masters?.states ?? []}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`city-${item.id}`, (token) => updateCity(token, item.id, payload))
              : runAction('city-create', (token) => createCity(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'occupation' ? (() => {
        const item = modal.item;
        return (
          <NamedMasterModal
            noun="Occupation"
            initial={item}
            subtitle="Configure occupation values available in the onboarding and LOS flows."
            maxLength={50}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`occupation-${item.id}`, (token) => updateOccupation(token, item.id, payload))
              : runAction('occupation-create', (token) => createOccupation(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'reasonForLoan' ? (() => {
        const item = modal.item;
        return (
          <NamedMasterModal
            noun="Reason for Loan"
            initial={item}
            subtitle="Configure reason for loan values available in LOS application and decisioning flows."
            maxLength={50}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`reason-for-loan-${item.id}`, (token) => updateReasonForLoan(token, item.id, payload))
              : runAction('reason-for-loan-create', (token) => createReasonForLoan(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'gender' ? (() => {
        const item = modal.item;
        return (
          <NamedMasterModal
            noun="Gender"
            initial={item}
            subtitle="Configure gender values available in the onboarding and application flows."
            maxLength={20}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`gender-${item.id}`, (token) => updateGender(token, item.id, payload))
              : runAction('gender-create', (token) => createGender(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'bank' ? (() => {
        const item = modal.item;
        return (
          <NamedMasterModal
            noun="Bank"
            initial={item}
            subtitle="Configure banks shown in the customer bank-details dropdown."
            maxLength={100}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`bank-${item.id}`, (token) => updateBank(token, item.id, payload))
              : runAction('bank-create', (token) => createBank(token, payload))}
          />
        );
      })() : null}

      {modal?.kind === 'dueDate' ? (() => {
        const item = modal.item;
        return (
          <DueDateModal
            initial={item}
            onClose={() => setModal(null)}
            onSubmit={(payload) => item
              ? runAction(`due-date-${item.id}`, (token) => updateRepaymentDueDate(token, item.id, { dueDate: payload.dueDate }))
              : runAction('due-date-create', (token) => createRepaymentDueDate(token, payload))}
          />
        );
      })() : null}
    </>
  );
}
