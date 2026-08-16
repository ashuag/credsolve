'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  getCreditLimitTiers,
  type LosCreditLimitTier,
  updateCreditLimitTier,
} from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLosToken,
  IconButton,
  ModalShell,
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

  const summary = useMemo(() => {
    const total = tiers.length;
    const active = tiers.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [tiers]);

  const columns = useMemo((): DataTableColumn<LosCreditLimitTier>[] => [
    {
      key: 'range',
      label: 'Eligible Range',
      getFilterValue: (item) => [
        formatRange(item),
        item.minUnsecuredLoan,
        item.maxUnsecuredLoan ?? '',
      ].join(' '),
      getSortValue: (item) => item.minUnsecuredLoan,
      filter: { type: 'text', placeholder: 'Search tiers, ranges…' },
      render: (item) => (
        <div className="grid gap-0.5">
          <strong>{formatRange(item)}</strong>
          <span className="text-[0.8rem] text-brand-muted">Min: {formatCurrency(item.minUnsecuredLoan)}</span>
        </div>
      ),
    },
    {
      key: 'maxBulletLoan',
      label: 'Max Bullet Loan',
      getFilterValue: (item) => item.maxBulletLoan,
      getSortValue: (item) => item.maxBulletLoan,
      filter: { type: 'number', placeholder: 'Amount…' },
      cellClassName: 'text-brand-muted',
      render: (item) => formatCurrency(item.maxBulletLoan),
    },
    {
      key: 'sortOrder',
      label: 'Priority',
      getFilterValue: (item) => item.sortOrder,
      getSortValue: (item) => item.sortOrder,
      filter: { type: 'number', placeholder: 'Priority…' },
      cellClassName: 'text-brand-muted',
      render: (item) => `#${item.sortOrder}`,
    },
    {
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
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
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
      ),
    },
  ], [busyKey]);

  return (
    <>
      <div className="grid gap-3">
        <SummaryCards total={summary.total} active={summary.active} inactive={summary.inactive} />

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {actionError}
          </div>
        ) : null}

        <div>
          <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">Credit Limit Eligibility Check</h2>
          <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
            Manage the unsecured credit-limit tiers used to determine approved bullet-loan ceilings. Bands are matched against total unsecured tradeline exposure (open and closed).
          </p>
        </div>

        <DataTable
          items={tiers}
          columns={columns}
          getRowKey={(item) => item.id}
          entityLabel="tiers"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadTiers()}
          emptyMessage="No credit limit tiers available right now."
          noResultsMessage="No credit limit tiers match your filters."
          tableClassName="text-[0.88rem]"
        />
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
