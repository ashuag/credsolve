'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  matchesActiveInactiveFilter,
  isoDateTimestamp,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  addNegativeCity,
  addNegativePincode,
  addNegativeState,
  getMasters,
  getNegativeLists,
  removeNegativeCity,
  removeNegativePincode,
  removeNegativeState,
  type LosCityMaster,
  type LosNegativeCity,
  type LosNegativePincode,
  type LosNegativeState,
  type LosStateMaster,
} from '@/lib/api';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLosToken,
  IconButton,
  StatusPill,
  SummaryCards,
} from './eligibility-ui';

type AuditUser = { fullName: string; email: string } | null;

type AuditListItem = {
  id: number;
  isActive: boolean;
  addedAt: string;
  addedBy: AuditUser;
  removedAt: string | null;
  removedBy: AuditUser;
};

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUserLabel(user: AuditUser) {
  if (!user) return '—';
  return user.fullName?.trim() || user.email;
}

function buildAuditColumns<T extends AuditListItem>({
  primaryLabel,
  primaryPlaceholder,
  getPrimaryText,
  renderPrimaryCell,
  renderActionCell,
}: {
  primaryLabel: string;
  primaryPlaceholder: string;
  getPrimaryText: (item: T) => string;
  renderPrimaryCell: (item: T) => ReactNode;
  renderActionCell: (item: T) => ReactNode;
}): DataTableColumn<T>[] {
  return [
    {
      key: 'primary',
      label: primaryLabel,
      getFilterValue: (item) => getPrimaryText(item),
      getSortValue: (item) => getPrimaryText(item).toLowerCase(),
      filter: { type: 'text', placeholder: primaryPlaceholder },
      render: (item) => renderPrimaryCell(item),
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
      key: 'added',
      label: 'Added',
      getFilterValue: (item) => item.addedAt,
      getSortValue: (item) => isoDateTimestamp(item.addedAt),
      filter: { type: 'date' },
      cellClassName: 'text-[0.78rem] whitespace-nowrap text-brand-muted',
      render: (item) => formatDateTime(item.addedAt),
    },
    {
      key: 'addedBy',
      label: 'Added by',
      getFilterValue: (item) => formatUserLabel(item.addedBy),
      getSortValue: (item) => formatUserLabel(item.addedBy).toLowerCase(),
      filter: { type: 'text', placeholder: 'Search user…' },
      cellClassName: 'text-[0.78rem] text-brand-navy',
      render: (item) => formatUserLabel(item.addedBy),
    },
    {
      key: 'removed',
      label: 'Removed',
      getFilterValue: (item) => item.removedAt,
      getSortValue: (item) => isoDateTimestamp(item.removedAt),
      filter: { type: 'date' },
      cellClassName: 'text-[0.78rem] whitespace-nowrap text-brand-muted',
      render: (item) => formatDateTime(item.removedAt),
    },
    {
      key: 'removedBy',
      label: 'Removed by',
      getFilterValue: (item) => formatUserLabel(item.removedBy),
      getSortValue: (item) => formatUserLabel(item.removedBy).toLowerCase(),
      filter: { type: 'text', placeholder: 'Search user…' },
      cellClassName: 'text-[0.78rem] text-brand-navy',
      render: (item) => formatUserLabel(item.removedBy),
    },
    {
      key: 'actions',
      label: 'Action',
      sortable: false,
      filter: false,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (item) => renderActionCell(item),
    },
  ];
}

function AuditDataTable<T extends AuditListItem>({
  primaryLabel,
  primaryPlaceholder,
  items,
  emptyMessage,
  entityLabel,
  getPrimaryText,
  renderPrimaryCell,
  renderActionCell,
}: {
  primaryLabel: string;
  primaryPlaceholder: string;
  items: T[];
  emptyMessage: string;
  entityLabel: string;
  getPrimaryText: (item: T) => string;
  renderPrimaryCell: (item: T) => ReactNode;
  renderActionCell: (item: T) => ReactNode;
}) {
  const columns = useMemo(
    () => buildAuditColumns({
      primaryLabel,
      primaryPlaceholder,
      getPrimaryText,
      renderPrimaryCell,
      renderActionCell,
    }),
    [getPrimaryText, primaryLabel, primaryPlaceholder, renderActionCell, renderPrimaryCell],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DataTable
        items={items}
        columns={columns}
        getRowKey={(item) => item.id}
        entityLabel={entityLabel}
        emptyMessage={emptyMessage}
        stickyHeader
        bordered={false}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        minWidth="760px"
      />
    </div>
  );
}

function ListPanelShell({
  title,
  description,
  summary,
  addForm,
  children,
}: {
  title: string;
  description: string;
  summary: { total: number; active: number; inactive: number };
  addForm: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-[rgba(23,44,113,0.1)]"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,246,255,0.95))' }}
    >
      <div className="border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
        <h2 className="m-0 text-[1.02rem] font-extrabold tracking-[-0.03em] text-brand-navy">{title}</h2>
        <p className="m-0 mt-1 text-[0.8rem] leading-[1.45] text-brand-muted">{description}</p>
      </div>

      <div className="border-b border-[rgba(23,44,113,0.07)] px-4 py-3">{addForm}</div>

      <div className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-4 py-3">
        <SummaryCards total={summary.total} active={summary.active} inactive={summary.inactive} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

function RemoveActionButton({
  item,
  busyId,
  onRemove,
}: {
  item: AuditListItem;
  busyId: number | null;
  onRemove: (id: number) => void;
}) {
  if (!item.isActive) return null;

  return (
    <IconButton
      title="Remove from list"
      tone="danger"
      disabled={busyId === item.id}
      onClick={() => void onRemove(item.id)}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      </svg>
    </IconButton>
  );
}

function PincodePanel({
  items,
  busyId,
  onAdd,
  onRemove,
}: {
  items: LosNegativePincode[];
  busyId: number | null;
  onAdd: (pincode: string, reason: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [pincode, setPincode] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);

  const getPrimaryText = useCallback(
    (item: LosNegativePincode) => `${item.pincode} ${item.reason ?? ''}`.trim(),
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = pincode.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(normalized, reason.trim());
      setPincode('');
      setReason('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add pincode.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ListPanelShell
      title="Negative Pincode"
      description="Blocklisted pincodes stop origination when the enforce rule is on."
      summary={summary}
      addForm={(
        <form className="grid gap-2" onSubmit={handleSubmit}>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              className="los-input"
              placeholder="6-digit pincode"
              value={pincode}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              required
            />
            <input
              className="los-input"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
            <button type="submit" className="los-btn-primary min-h-[40px]" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error ? <p className="m-0 text-[0.8rem] text-[#8d3434]">{error}</p> : null}
        </form>
      )}
    >
      <AuditDataTable
        primaryLabel="Pincode"
        primaryPlaceholder="Search pincode or reason…"
        items={items}
        emptyMessage="No pincodes in this list."
        entityLabel="pincodes"
        getPrimaryText={getPrimaryText}
        renderPrimaryCell={(item) => (
          <div>
            <strong className="block text-brand-navy">{item.pincode}</strong>
            {item.reason ? <span className="text-[0.76rem] text-brand-muted">{item.reason}</span> : null}
          </div>
        )}
        renderActionCell={(item) => <RemoveActionButton item={item} busyId={busyId} onRemove={onRemove} />}
      />
    </ListPanelShell>
  );
}

function CityPanel({
  items,
  cities,
  busyId,
  onAdd,
  onRemove,
}: {
  items: LosNegativeCity[];
  cities: LosCityMaster[];
  busyId: number | null;
  onAdd: (cityId: number, reason: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [cityId, setCityId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCities = useMemo(
    () => cities.filter((city) => city.isActive && city.stateIsActive).sort((a, b) => `${a.stateName} ${a.name}`.localeCompare(`${b.stateName} ${b.name}`)),
    [cities],
  );

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);

  const getPrimaryText = useCallback(
    (item: LosNegativeCity) => `${item.cityName} ${item.stateName} ${item.stateCode} ${item.reason ?? ''}`.trim(),
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(cityId);
    if (!parsed) {
      setError('Select a city.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(parsed, reason.trim());
      setCityId('');
      setReason('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add city.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ListPanelShell
      title="Negative City"
      description="Blocked cities reject origination when the enforce rule is on."
      summary={summary}
      addForm={(
        <form className="grid gap-2" onSubmit={handleSubmit}>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <select className="los-input" value={cityId} onChange={(event) => setCityId(event.target.value)} required>
              <option value="">Select city</option>
              {activeCities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.stateName})
                </option>
              ))}
            </select>
            <input
              className="los-input"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
            <button type="submit" className="los-btn-primary min-h-[40px]" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error ? <p className="m-0 text-[0.8rem] text-[#8d3434]">{error}</p> : null}
        </form>
      )}
    >
      <AuditDataTable
        primaryLabel="City"
        primaryPlaceholder="Search city, state, or reason…"
        items={items}
        emptyMessage="No cities in this list."
        entityLabel="cities"
        getPrimaryText={getPrimaryText}
        renderPrimaryCell={(item) => (
          <div>
            <strong className="block text-brand-navy">{item.cityName}</strong>
            <span className="text-[0.76rem] text-brand-muted">{item.stateName} ({item.stateCode})</span>
            {item.reason ? <span className="mt-0.5 block text-[0.76rem] text-brand-muted">{item.reason}</span> : null}
          </div>
        )}
        renderActionCell={(item) => <RemoveActionButton item={item} busyId={busyId} onRemove={onRemove} />}
      />
    </ListPanelShell>
  );
}

function StatePanel({
  items,
  states,
  busyId,
  onAdd,
  onRemove,
}: {
  items: LosNegativeState[];
  states: LosStateMaster[];
  busyId: number | null;
  onAdd: (stateId: number, reason: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [stateId, setStateId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStates = useMemo(
    () => states.filter((state) => state.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [states],
  );

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);

  const getPrimaryText = useCallback(
    (item: LosNegativeState) => `${item.stateName} ${item.stateCode} ${item.reason ?? ''}`.trim(),
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(stateId);
    if (!parsed) {
      setError('Select a state.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(parsed, reason.trim());
      setStateId('');
      setReason('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add state.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ListPanelShell
      title="Negative State"
      description="Blocked states reject origination when the enforce rule is on."
      summary={summary}
      addForm={(
        <form className="grid gap-2" onSubmit={handleSubmit}>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <select className="los-input" value={stateId} onChange={(event) => setStateId(event.target.value)} required>
              <option value="">Select state</option>
              {activeStates.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name} ({state.code})
                </option>
              ))}
            </select>
            <input
              className="los-input"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
            <button type="submit" className="los-btn-primary min-h-[40px]" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error ? <p className="m-0 text-[0.8rem] text-[#8d3434]">{error}</p> : null}
        </form>
      )}
    >
      <AuditDataTable
        primaryLabel="State"
        primaryPlaceholder="Search state or reason…"
        items={items}
        emptyMessage="No states in this list."
        entityLabel="states"
        getPrimaryText={getPrimaryText}
        renderPrimaryCell={(item) => (
          <div>
            <strong className="block text-brand-navy">{item.stateName}</strong>
            <span className="text-[0.76rem] text-brand-muted">{item.stateCode}</span>
            {item.reason ? <span className="mt-0.5 block text-[0.76rem] text-brand-muted">{item.reason}</span> : null}
          </div>
        )}
        renderActionCell={(item) => <RemoveActionButton item={item} busyId={busyId} onRemove={onRemove} />}
      />
    </ListPanelShell>
  );
}

export function NegativeListsPanel({ scope = 'all' }: { scope?: 'all' | 'pincode' | 'city' | 'state' }) {
  const [pincodes, setPincodes] = useState<LosNegativePincode[]>([]);
  const [cities, setCities] = useState<LosNegativeCity[]>([]);
  const [states, setStates] = useState<LosNegativeState[]>([]);
  const [masterCities, setMasterCities] = useState<LosCityMaster[]>([]);
  const [masterStates, setMasterStates] = useState<LosStateMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyPincodeId, setBusyPincodeId] = useState<number | null>(null);
  const [busyCityId, setBusyCityId] = useState<number | null>(null);
  const [busyStateId, setBusyStateId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const token = getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);
    try {
      const [lists, masters] = await Promise.all([getNegativeLists(token), getMasters(token)]);
      setPincodes(lists.pincodes);
      setCities(lists.cities);
      setStates(lists.states);
      setMasterCities(masters.cities);
      setMasterStates(masters.states);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load negative lists.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function withToken<T>(action: (token: string) => Promise<T>): Promise<T> {
    const token = getLosToken();
    if (!token) {
      throw new Error('Session expired - please log in again.');
    }
    return action(token);
  }

  if (loading) {
    return (
      <div className="rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white px-5 py-10 text-center text-[0.9rem] text-brand-muted">
        Loading serviceability lists…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-[14px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] px-5 py-6 text-[#8d3434]">
        <p className="m-0">{fetchError}</p>
        <button type="button" className="los-btn-primary mt-3" onClick={() => void loadData()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {actionError ? (
        <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
          {actionError}
        </div>
      ) : null}

      <div className={scope === 'all' ? 'grid gap-3 xl:grid-cols-3' : 'grid gap-3'}>
        {(scope === 'all' || scope === 'pincode') ? (
          <PincodePanel
            items={pincodes}
            busyId={busyPincodeId}
            onAdd={async (pincode, reason) => {
              setActionError(null);
              const saved = await withToken((token) => addNegativePincode(token, { pincode, reason: reason || undefined }));
              setPincodes((current) => {
                const without = current.filter((item) => item.id !== saved.id);
                return [saved, ...without];
              });
            }}
            onRemove={async (id) => {
              setActionError(null);
              setBusyPincodeId(id);
              try {
                const saved = await withToken((token) => removeNegativePincode(token, id));
                setPincodes((current) => current.map((item) => (item.id === saved.id ? saved : item)));
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Unable to remove pincode.');
              } finally {
                setBusyPincodeId(null);
              }
            }}
          />
        ) : null}

        {(scope === 'all' || scope === 'city') ? (
          <CityPanel
            items={cities}
            cities={masterCities}
            busyId={busyCityId}
            onAdd={async (cityId, reason) => {
              setActionError(null);
              const saved = await withToken((token) => addNegativeCity(token, { cityId, reason: reason || undefined }));
              setCities((current) => {
                const without = current.filter((item) => item.id !== saved.id);
                return [saved, ...without];
              });
            }}
            onRemove={async (id) => {
              setActionError(null);
              setBusyCityId(id);
              try {
                const saved = await withToken((token) => removeNegativeCity(token, id));
                setCities((current) => current.map((item) => (item.id === saved.id ? saved : item)));
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Unable to remove city.');
              } finally {
                setBusyCityId(null);
              }
            }}
          />
        ) : null}

        {(scope === 'all' || scope === 'state') ? (
          <StatePanel
            items={states}
            states={masterStates}
            busyId={busyStateId}
            onAdd={async (stateId, reason) => {
              setActionError(null);
              const saved = await withToken((token) => addNegativeState(token, { stateId, reason: reason || undefined }));
              setStates((current) => {
                const without = current.filter((item) => item.id !== saved.id);
                return [saved, ...without];
              });
            }}
            onRemove={async (id) => {
              setActionError(null);
              setBusyStateId(id);
              try {
                const saved = await withToken((token) => removeNegativeState(token, id));
                setStates((current) => current.map((item) => (item.id === saved.id ? saved : item)));
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Unable to remove state.');
              } finally {
                setBusyStateId(null);
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
