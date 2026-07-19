'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  createVendorApiConfig,
  getVendorApiConfigs,
  type LosVendorApiConfig,
  updateVendorApiConfig,
} from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  cx,
  getLosToken,
  IconButton,
  ModalShell,
  SummaryCards,
} from '@/components/eligibility/eligibility-ui';

function StatusBadge({ status }: { status: string }) {
  const active = status.toUpperCase() === 'ACTIVE';
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.06em]',
        active
          ? 'bg-[rgba(34,197,94,0.14)] text-[#15803d]'
          : 'bg-[rgba(148,163,184,0.18)] text-[#475569]',
      )}
    >
      {status}
    </span>
  );
}

function AddVendorApiModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    apiCode: string;
    apiName: string;
    vendorName: string;
    priority: number;
    status: string;
    notes?: string;
  }) => Promise<unknown>;
}) {
  const [apiCode, setApiCode] = useState('');
  const [apiName, setApiName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [priority, setPriority] = useState('1');
  const [status, setStatus] = useState('ACTIVE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const priorityNum = Number.parseInt(priority, 10);
      await onSubmit({
        apiCode: apiCode.trim().toLowerCase(),
        apiName: apiName.trim(),
        vendorName: vendorName.trim(),
        priority: Number.isFinite(priorityNum) ? priorityNum : 1,
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add vendor API.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Add vendor API"
      subtitle="Register a primary or backup vendor for a logical API (e.g. cibil_fetch)."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">API code</span>
          <input
            className="los-input"
            value={apiCode}
            onChange={(event) => setApiCode(event.target.value)}
            placeholder="cibil_fetch"
            maxLength={64}
            required
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">API name</span>
          <input
            className="los-input"
            value={apiName}
            onChange={(event) => setApiName(event.target.value)}
            placeholder="CIBIL fetch"
            maxLength={120}
            required
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Vendor name</span>
          <input
            className="los-input"
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
            placeholder="Tenacio"
            maxLength={80}
            required
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Priority</span>
          <input
            className="los-input"
            type="number"
            min={1}
            max={99}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            required
          />
          <span className="text-[0.78rem] text-brand-muted">
            1 = primary, 2+ = fallback (tried automatically when the primary errors).
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Status</span>
          <select className="los-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Notes</span>
          <input
            className="los-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={255}
          />
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text"
          >
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Add API'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function VendorApiConfigPanel() {
  const [rows, setRows] = useState<LosVendorApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadRows = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await getVendorApiConfigs(token);
      setRows(response);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load vendor API configs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

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
      await loadRows(token);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleStatus(item: LosVendorApiConfig) {
    const next = item.status.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Mark ${item.apiName} (${item.vendorName}) as ${next}?`)) return;
    await runAction(`vendor-api-${item.id}`, (token) =>
      updateVendorApiConfig(token, item.id, { status: next }),
    );
  }

  const summary = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((item) => item.status.toUpperCase() === 'ACTIVE').length;
    return { total, active, inactive: total - active };
  }, [rows]);

  const columns = useMemo((): DataTableColumn<LosVendorApiConfig>[] => [
    {
      key: 'apiCode',
      label: 'API code',
      getFilterValue: (item) => item.apiCode,
      getSortValue: (item) => item.apiCode.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search code…' },
      cellClassName: 'font-mono text-[0.82rem] font-bold',
      render: (item) => item.apiCode,
    },
    {
      key: 'apiName',
      label: 'API name',
      getFilterValue: (item) => item.apiName,
      getSortValue: (item) => item.apiName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      cellClassName: 'font-bold',
      render: (item) => item.apiName,
    },
    {
      key: 'vendorName',
      label: 'Vendor',
      getFilterValue: (item) => item.vendorName,
      getSortValue: (item) => item.vendorName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search vendor…' },
      render: (item) => item.vendorName,
    },
    {
      key: 'priority',
      label: 'Priority',
      getFilterValue: (item) => item.priority,
      getSortValue: (item) => item.priority,
      filter: { type: 'number', placeholder: 'Priority…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.priority,
    },
    {
      key: 'status',
      label: 'Status',
      getFilterValue: (item) => (item.status.toUpperCase() === 'ACTIVE' ? 'active' : 'inactive'),
      getSortValue: (item) => (item.status.toUpperCase() === 'ACTIVE' ? 0 : 1),
      filter: {
        type: 'select',
        options: [...ACTIVE_INACTIVE_FILTER_OPTIONS],
        matches: (item, value) =>
          matchesActiveInactiveFilter(item.status.toUpperCase() === 'ACTIVE', value),
      },
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'notes',
      label: 'Notes',
      getFilterValue: (item) => item.notes ?? '',
      getSortValue: (item) => (item.notes ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search notes…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.notes ?? '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <IconButton
          title={item.status.toUpperCase() === 'ACTIVE' ? 'Switch off' : 'Switch on'}
          tone={item.status.toUpperCase() === 'ACTIVE' ? 'danger' : 'default'}
          disabled={busyKey === `vendor-api-${item.id}`}
          onClick={() => {
            void handleToggleStatus(item);
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2v10" />
            <path d="M18.4 6.6a8 8 0 1 1-12.8 0" />
          </svg>
        </IconButton>
      ),
    },
  ], [busyKey]);

  return (
    <>
      <div className="grid gap-3">
        <SummaryCards total={summary.total} active={summary.active} inactive={summary.inactive} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">Vendor APIs</h2>
            <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
              Switch vendor APIs on or off. The lowest ACTIVE priority is called first; the next
              ACTIVE vendor is used automatically as a fallback when it errors.
            </p>
          </div>
          <button type="button" className="los-btn-primary" onClick={() => setAdding(true)}>
            Add vendor API
          </button>
        </div>

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {actionError}
          </div>
        ) : null}

        <DataTable
          items={rows}
          columns={columns}
          getRowKey={(item) => item.id}
          entityLabel="vendor APIs"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadRows()}
          emptyMessage="No vendor API configs yet. Add one to get started."
        />
      </div>

      {adding ? (
        <AddVendorApiModal
          onClose={() => setAdding(false)}
          onSubmit={(data) =>
            runAction('vendor-api-create', (token) => createVendorApiConfig(token, data))
          }
        />
      ) : null}
    </>
  );
}
