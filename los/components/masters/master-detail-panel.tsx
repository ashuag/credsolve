'use client';

import Link from 'next/link';
import {
  LOS_LEAD_SOURCE_TYPES,
  createBank,
  createCity,
  createGender,
  createLeadSource,
  createOccupation,
  createReasonForLoan,
  createState,
  deleteBank,
  getMasters,
  type LosCityMaster,
  type LosLeadSourceMaster,
  type LosLeadSourceType,
  type LosMastersPayload,
  type LosNamedMaster,
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
  updateState,
} from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { cx } from '@/lib/cx';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getMasterDefinition, type MasterSlug } from './master-definitions';

const CITY_PAGE_SIZE = 10;

type StatusFilter = 'all' | 'active' | 'inactive';

type ModalState =
  | { kind: 'leadStatus'; item: LosStatusMaster }
  | { kind: 'applicationStatus'; item: LosStatusMaster }
  | { kind: 'leadSource'; item?: LosLeadSourceMaster }
  | { kind: 'state'; item?: LosStateMaster }
  | { kind: 'city'; item?: LosCityMaster }
  | { kind: 'occupation'; item?: LosNamedMaster }
  | { kind: 'reasonForLoan'; item?: LosNamedMaster }
  | { kind: 'gender'; item?: LosNamedMaster }
  | { kind: 'bank'; item?: LosNamedMaster };

function formatLeadSourceType(type: LosLeadSourceType) {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusBadge(isActive: boolean) {
  return isActive
    ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]'
    : 'bg-[rgba(239,68,68,0.1)] text-[#991b1b]';
}

function applyStatusFilter<T extends { isActive: boolean }>(items: T[], filter: StatusFilter) {
  if (filter === 'active') return items.filter((item) => item.isActive);
  if (filter === 'inactive') return items.filter((item) => !item.isActive);
  return items;
}

function StatusPill({ isActive }: { isActive: boolean }) {
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'min-h-[34px] cursor-pointer rounded-full border px-3 py-1 text-[0.78rem] font-bold transition-colors',
        active
          ? 'border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.1)] text-brand-blue'
          : 'border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.85)] text-brand-muted',
      )}
    >
      {label}
    </button>
  );
}

function PageShell({
  title,
  description,
  search,
  onSearchChange,
  searchPlaceholder,
  statusFilter,
  onStatusFilterChange,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[16px] border border-[rgba(23,44,113,0.1)]"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,246,255,0.95))' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(23,44,113,0.07)] px-5 py-4">
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

      <div className="grid gap-3 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="los-input"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All" active={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')} />
          <FilterChip label="Active" active={statusFilter === 'active'} onClick={() => onStatusFilterChange('active')} />
          <FilterChip label="Inactive" active={statusFilter === 'inactive'} onClick={() => onStatusFilterChange('inactive')} />
        </div>
      </div>

      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-4 py-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentPage <= 1}
        className="min-h-[34px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.82rem] font-bold text-brand-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-[0.8rem] font-bold text-brand-muted">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={currentPage >= totalPages}
        className="min-h-[34px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.82rem] font-bold text-brand-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
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

export function MasterDetailPanel({ master }: { master: MasterSlug }) {
  const definition = getMasterDefinition(master);
  const [masters, setMasters] = useState<LosMastersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cityPage, setCityPage] = useState(1);
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

  const filteredLeadStatuses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.leadStatuses ?? []).filter((item) => (
      term === '' || item.code.toLowerCase().includes(term) || item.displayName.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.leadStatuses, search, statusFilter]);

  const filteredApplicationStatuses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.applicationStatuses ?? []).filter((item) => (
      term === '' || item.code.toLowerCase().includes(term) || item.displayName.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.applicationStatuses, search, statusFilter]);

  const filteredLeadSources = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.leadSources ?? []).filter((item) => (
      term === '' || item.name.toLowerCase().includes(term) || item.type.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.leadSources, search, statusFilter]);

  const filteredStates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.states ?? []).filter((item) => (
      term === '' || item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.states, search, statusFilter]);

  const filteredCities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.cities ?? []).filter((item) => (
      term === ''
      || item.name.toLowerCase().includes(term)
      || item.stateName.toLowerCase().includes(term)
      || item.stateCode.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.cities, search, statusFilter]);

  const filteredOccupations = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.occupations ?? []).filter((item) => (
      term === '' || item.name.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.occupations, search, statusFilter]);

  const filteredReasonsForLoan = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.reasonsForLoan ?? []).filter((item) => (
      term === '' || item.name.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.reasonsForLoan, search, statusFilter]);

  const filteredGenders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.genders ?? []).filter((item) => (
      term === '' || item.name.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.genders, search, statusFilter]);

  const filteredBanks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (masters?.banks ?? []).filter((item) => (
      term === '' || item.name.toLowerCase().includes(term)
    ));
    return applyStatusFilter(filtered, statusFilter);
  }, [masters?.banks, search, statusFilter]);

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
      default:
        return [];
    }
  }, [master, masters]);

  const totalCityPages = Math.max(1, Math.ceil(filteredCities.length / CITY_PAGE_SIZE));

  const paginatedCities = useMemo(() => {
    const startIndex = (cityPage - 1) * CITY_PAGE_SIZE;
    return filteredCities.slice(startIndex, startIndex + CITY_PAGE_SIZE);
  }, [cityPage, filteredCities]);

  const cityRange = useMemo(() => {
    if (filteredCities.length === 0) return { start: 0, end: 0 };
    const start = ((cityPage - 1) * CITY_PAGE_SIZE) + 1;
    const end = Math.min(cityPage * CITY_PAGE_SIZE, filteredCities.length);
    return { start, end };
  }, [cityPage, filteredCities.length]);

  useEffect(() => {
    setCityPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setCityPage((currentPage) => Math.min(currentPage, totalCityPages));
  }, [totalCityPages]);

  const summary = useMemo(() => {
    const total = currentItems.length;
    const active = currentItems.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [currentItems]);

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

        {fetchError ? (
          <div className="rounded-[12px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-6 text-[0.9rem] text-[#8d3434]">
            {fetchError}
          </div>
        ) : loading && !masters ? (
          <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.9)] p-8 text-center text-[0.88rem] text-brand-muted">
            Loading master data...
          </div>
        ) : (
          <>
            {master === 'lead-statuses' ? (
              <PageShell
                title="Lead Status"
                description="Manage active and inactive lead workflow statuses while keeping the system codes unchanged."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Code', 'Display label', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeadStatuses.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredLeadStatuses.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.code}</strong></td>
                        <td className="px-4 py-3 text-brand-muted">{item.displayName}</td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit lead status label" onClick={() => setModal({ kind: 'leadStatus', item })} disabled={busyKey === `lead-status-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate lead status"
                                tone="danger"
                                disabled={busyKey === `lead-status-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `lead-status-${item.id}`,
                                    (token) => updateLeadStatus(token, item.id, { isActive: false }),
                                    `Mark ${item.code} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate lead status"
                                tone="success"
                                disabled={busyKey === `lead-status-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `lead-status-${item.id}`,
                                    (token) => updateLeadStatus(token, item.id, { isActive: true }),
                                    `Mark ${item.code} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredLeadStatuses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No lead statuses match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'application-statuses' ? (
              <PageShell
                title="Application Status"
                description="Manage active and inactive application stages while keeping the underlying workflow codes fixed."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Code', 'Display label', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicationStatuses.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredApplicationStatuses.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.code}</strong></td>
                        <td className="px-4 py-3 text-brand-muted">{item.displayName}</td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit application status label" onClick={() => setModal({ kind: 'applicationStatus', item })} disabled={busyKey === `application-status-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate application status"
                                tone="danger"
                                disabled={busyKey === `application-status-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `application-status-${item.id}`,
                                    (token) => updateApplicationStatus(token, item.id, { isActive: false }),
                                    `Mark ${item.code} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate application status"
                                tone="success"
                                disabled={busyKey === `application-status-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `application-status-${item.id}`,
                                    (token) => updateApplicationStatus(token, item.id, { isActive: true }),
                                    `Mark ${item.code} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredApplicationStatuses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No application statuses match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'lead-sources' ? (
              <PageShell
                title="Lead Sources"
                description="Add, edit, activate, and deactivate lead sources used for attribution and routing."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add Lead Source"
                onAction={() => setModal({ kind: 'leadSource' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Name', 'Type', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeadSources.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredLeadSources.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3 text-brand-muted">{formatLeadSourceType(item.type)}</td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit lead source" onClick={() => setModal({ kind: 'leadSource', item })} disabled={busyKey === `lead-source-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate lead source"
                                tone="danger"
                                disabled={busyKey === `lead-source-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `lead-source-${item.id}`,
                                    (token) => updateLeadSource(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate lead source"
                                tone="success"
                                disabled={busyKey === `lead-source-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `lead-source-${item.id}`,
                                    (token) => updateLeadSource(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredLeadSources.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No lead sources match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'states' ? (
              <PageShell
                title="States"
                description="Maintain state names, codes, and active state used by location masters."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add State"
                onAction={() => setModal({ kind: 'state' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['State', 'Code', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStates.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredStates.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3 text-brand-muted">{item.code}</td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit state" onClick={() => setModal({ kind: 'state', item })} disabled={busyKey === `state-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate state"
                                tone="danger"
                                disabled={busyKey === `state-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `state-${item.id}`,
                                    (token) => updateState(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate state"
                                tone="success"
                                disabled={busyKey === `state-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `state-${item.id}`,
                                    (token) => updateState(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No states match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'cities' ? (
              <PageShell
                title="Cities"
                description="Manage city names, state mappings, and active state used by onboarding and LOS lookup flows."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add City"
                onAction={() => setModal({ kind: 'city' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['City', 'State', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCities.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === paginatedCities.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3 text-brand-muted">
                          {item.stateName} ({item.stateCode}){item.stateIsActive ? '' : ' - Inactive state'}
                        </td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit city" onClick={() => setModal({ kind: 'city', item })} disabled={busyKey === `city-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate city"
                                tone="danger"
                                disabled={busyKey === `city-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `city-${item.id}`,
                                    (token) => updateCity(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate city"
                                tone="success"
                                disabled={busyKey === `city-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `city-${item.id}`,
                                    (token) => updateCity(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedCities.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No cities match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {filteredCities.length > 0 ? (
                  <div className="grid gap-0">
                    <div className="border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-4 py-2.5 text-[0.8rem] text-brand-muted">
                      Showing {cityRange.start}-{cityRange.end} of {filteredCities.length} cities
                    </div>
                    <PaginationControls
                      currentPage={cityPage}
                      totalPages={totalCityPages}
                      onPrevious={() => setCityPage((currentPage) => Math.max(1, currentPage - 1))}
                      onNext={() => setCityPage((currentPage) => Math.min(totalCityPages, currentPage + 1))}
                    />
                  </div>
                ) : null}
              </PageShell>
            ) : null}

            {master === 'occupations' ? (
              <PageShell
                title="Occupations"
                description="Manage occupation values shown in customer and LOS forms, including active and inactive options."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add Occupation"
                onAction={() => setModal({ kind: 'occupation' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Occupation', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOccupations.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredOccupations.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit occupation" onClick={() => setModal({ kind: 'occupation', item })} disabled={busyKey === `occupation-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate occupation"
                                tone="danger"
                                disabled={busyKey === `occupation-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `occupation-${item.id}`,
                                    (token) => updateOccupation(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate occupation"
                                tone="success"
                                disabled={busyKey === `occupation-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `occupation-${item.id}`,
                                    (token) => updateOccupation(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredOccupations.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">No occupations match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'reasons-for-loan' ? (
              <PageShell
                title="Reason for Loan"
                description="Maintain reason for loan values used across LOS application journeys, including active and inactive options."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add Reason for Loan"
                onAction={() => setModal({ kind: 'reasonForLoan' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Reason for Loan', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReasonsForLoan.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredReasonsForLoan.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit reason for loan" onClick={() => setModal({ kind: 'reasonForLoan', item })} disabled={busyKey === `reason-for-loan-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate reason for loan"
                                tone="danger"
                                disabled={busyKey === `reason-for-loan-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `reason-for-loan-${item.id}`,
                                    (token) => updateReasonForLoan(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate reason for loan"
                                tone="success"
                                disabled={busyKey === `reason-for-loan-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `reason-for-loan-${item.id}`,
                                    (token) => updateReasonForLoan(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredReasonsForLoan.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">No reason for loan values match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'genders' ? (
              <PageShell
                title="Genders"
                description="Maintain gender options used in onboarding and application details, including active and inactive values."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add Gender"
                onAction={() => setModal({ kind: 'gender' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Gender', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGenders.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredGenders.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <IconButton title="Edit gender" onClick={() => setModal({ kind: 'gender', item })} disabled={busyKey === `gender-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate gender"
                                tone="danger"
                                disabled={busyKey === `gender-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `gender-${item.id}`,
                                    (token) => updateGender(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate gender"
                                tone="success"
                                disabled={busyKey === `gender-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `gender-${item.id}`,
                                    (token) => updateGender(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredGenders.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">No genders match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}

            {master === 'banks' ? (
              <PageShell
                title="Banks"
                description="Manage banks offered in the customer bank-details step. Inactive banks are hidden from the dropdown; delete removes the row permanently."
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={definition.searchPlaceholder}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                actionLabel="+ Add Bank"
                onAction={() => setModal({ kind: 'bank' })}
              >
                <table className="w-full border-collapse text-[0.88rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                      {['Bank', 'Status', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBanks.map((item, index) => (
                      <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredBanks.length - 1 && 'border-b-0')}>
                        <td className="px-4 py-3"><strong>{item.name}</strong></td>
                        <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <IconButton title="Edit bank" onClick={() => setModal({ kind: 'bank', item })} disabled={busyKey === `bank-${item.id}` || busyKey === `bank-delete-${item.id}`}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {item.isActive ? (
                              <IconButton
                                title="Deactivate bank"
                                tone="danger"
                                disabled={busyKey === `bank-${item.id}` || busyKey === `bank-delete-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `bank-${item.id}`,
                                    (token) => updateBank(token, item.id, { isActive: false }),
                                    `Mark ${item.name} as inactive?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6" />
                                  <path d="M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </IconButton>
                            ) : (
                              <IconButton
                                title="Activate bank"
                                tone="success"
                                disabled={busyKey === `bank-${item.id}` || busyKey === `bank-delete-${item.id}`}
                                onClick={() => {
                                  void handleSoftToggle(
                                    `bank-${item.id}`,
                                    (token) => updateBank(token, item.id, { isActive: true }),
                                    `Mark ${item.name} as active?`,
                                  );
                                }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                              </IconButton>
                            )}
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
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBanks.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">No banks match the current search.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </PageShell>
            ) : null}
          </>
        )}
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
    </>
  );
}
