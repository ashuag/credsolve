'use client';

import {
  getCreditLimitTiers,
  type LosCreditLimitTier,
  updateCreditLimitTier,
} from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyStatusFilter,
  cx,
  getLosToken,
  IconButton,
  ModalShell,
  PageShell,
  type StatusFilter,
  StatusPill,
  SummaryCards,
} from './eligibility-ui';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRange(item: LosCreditLimitTier) {
  if (item.maxUnsecuredLoan === null) {
    return `${formatCurrency(item.minUnsecuredLoan)} and above`;
  }

  return `${formatCurrency(item.minUnsecuredLoan)} - ${formatCurrency(item.maxUnsecuredLoan)}`;
}

function CreditLimitTierModal({
  item,
  onClose,
  onSubmit,
}: {
  item: LosCreditLimitTier;
  onClose: () => void;
  onSubmit: (payload: {
    minUnsecuredLoan: number;
    maxUnsecuredLoan: number | null;
    maxBulletLoan: number;
    sortOrder: number;
  }) => Promise<unknown>;
}) {
  const [minUnsecuredLoan, setMinUnsecuredLoan] = useState(String(item.minUnsecuredLoan));
  const [maxUnsecuredLoan, setMaxUnsecuredLoan] = useState(item.maxUnsecuredLoan === null ? '' : String(item.maxUnsecuredLoan));
  const [maxBulletLoan, setMaxBulletLoan] = useState(String(item.maxBulletLoan));
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextMin = Number(minUnsecuredLoan);
    const nextMax = maxUnsecuredLoan.trim() === '' ? null : Number(maxUnsecuredLoan);
    const nextBullet = Number(maxBulletLoan);
    const nextSortOrder = Number(sortOrder);

    if ([nextMin, nextBullet, nextSortOrder].some((value) => Number.isNaN(value))) {
      setError('Enter valid numeric values.');
      return;
    }

    if (nextMin < 0 || nextBullet < 0 || nextSortOrder < 0) {
      setError('Values cannot be negative.');
      return;
    }

    if (nextMax !== null && Number.isNaN(nextMax)) {
      setError('Enter a valid maximum unsecured loan or leave it blank.');
      return;
    }

    if (nextMax !== null && nextMax < nextMin) {
      setError('Maximum unsecured loan must be greater than or equal to the minimum.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        minUnsecuredLoan: nextMin,
        maxUnsecuredLoan: nextMax,
        maxBulletLoan: nextBullet,
        sortOrder: nextSortOrder,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save credit limit tier.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Edit Credit Limit Tier"
      subtitle="Update the unsecured credit range, bullet-loan cap, and rule priority used by the eligibility engine."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[0.9rem] font-bold">Minimum unsecured loan</span>
            <input className="los-input" type="number" min={0} step={1} value={minUnsecuredLoan} onChange={(event) => setMinUnsecuredLoan(event.target.value)} required />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[0.9rem] font-bold">Maximum unsecured loan</span>
            <input className="los-input" type="number" min={0} step={1} value={maxUnsecuredLoan} onChange={(event) => setMaxUnsecuredLoan(event.target.value)} placeholder="Leave blank for no upper limit" />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[0.9rem] font-bold">Maximum bullet loan</span>
            <input className="los-input" type="number" min={0} step={1} value={maxBulletLoan} onChange={(event) => setMaxBulletLoan(event.target.value)} required />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[0.9rem] font-bold">Sort order</span>
            <input className="los-input" type="number" min={0} step={1} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} required />
          </label>
        </div>

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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function CreditLimitEligibilityPanel() {
  const [tiers, setTiers] = useState<LosCreditLimitTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<LosCreditLimitTier | null>(null);

  const loadTiers = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await getCreditLimitTiers(token);
      setTiers(response);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load credit limit tiers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

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
      await loadTiers(token);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSoftToggle(item: LosCreditLimitTier, isActive: boolean) {
    if (!window.confirm(`Mark tier ${formatRange(item)} as ${isActive ? 'active' : 'inactive'}?`)) return;
    await runAction(`tier-${item.id}`, (token) => updateCreditLimitTier(token, item.id, { isActive }));
  }

  const filteredTiers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = tiers.filter((item) => (
      term === ''
      || formatRange(item).toLowerCase().includes(term)
      || formatCurrency(item.maxBulletLoan).toLowerCase().includes(term)
      || String(item.sortOrder).includes(term)
      || String(item.minUnsecuredLoan).includes(term)
      || String(item.maxUnsecuredLoan ?? '').includes(term)
    ));

    return applyStatusFilter(filtered, statusFilter);
  }, [tiers, search, statusFilter]);

  const summary = useMemo(() => {
    const total = tiers.length;
    const active = tiers.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [tiers]);

  return (
    <>
      <div className="grid gap-3">
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
        ) : loading ? (
          <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.9)] p-8 text-center text-[0.88rem] text-brand-muted">
            Loading credit limit tiers...
          </div>
        ) : (
          <PageShell
            title="Credit Limit Eligibility Check"
            description="Manage the unsecured credit-limit tiers used to determine approved bullet-loan ceilings and rule priority during eligibility checks."
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search tiers, ranges, sort order..."
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          >
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                  {['Eligible Range', 'Max Bullet Loan', 'Priority', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTiers.map((item, index) => (
                  <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredTiers.length - 1 && 'border-b-0')}>
                    <td className="px-4 py-3">
                      <div className="grid gap-0.5">
                        <strong>{formatRange(item)}</strong>
                        <span className="text-[0.8rem] text-brand-muted">Min: {formatCurrency(item.minUnsecuredLoan)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-muted">{formatCurrency(item.maxBulletLoan)}</td>
                    <td className="px-4 py-3 text-brand-muted">#{item.sortOrder}</td>
                    <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <IconButton title="Edit credit limit tier" onClick={() => setEditing(item)} disabled={busyKey === `tier-${item.id}`}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </IconButton>
                        {item.isActive ? (
                          <IconButton
                            title="Deactivate credit limit tier"
                            tone="danger"
                            disabled={busyKey === `tier-${item.id}`}
                            onClick={() => {
                              void handleSoftToggle(item, false);
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
                            title="Activate credit limit tier"
                            tone="success"
                            disabled={busyKey === `tier-${item.id}`}
                            onClick={() => {
                              void handleSoftToggle(item, true);
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
                {filteredTiers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">No credit limit tiers match the current search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </PageShell>
        )}
      </div>

      {editing ? (
        <CreditLimitTierModal
          item={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => runAction(`tier-${editing.id}`, (token) => updateCreditLimitTier(token, editing.id, payload))}
        />
      ) : null}
    </>
  );
}
