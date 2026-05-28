'use client';

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
  applyStatusFilter,
  cx,
  getLosToken,
  IconButton,
  type StatusFilter,
  StatusPill,
  SummaryCards,
} from './eligibility-ui';

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

function formatUserLabel(user: { fullName: string; email: string } | null) {
  if (!user) return '—';
  return user.fullName?.trim() || user.email;
}

function AuditCells({
  addedAt,
  addedBy,
  removedAt,
  removedBy,
}: {
  addedAt: string;
  addedBy: { fullName: string; email: string } | null;
  removedAt: string | null;
  removedBy: { fullName: string; email: string } | null;
}) {
  return (
    <>
      <td className="px-3 py-2.5 text-[0.78rem] text-brand-muted whitespace-nowrap">{formatDateTime(addedAt)}</td>
      <td className="px-3 py-2.5 text-[0.78rem] text-brand-navy">{formatUserLabel(addedBy)}</td>
      <td className="px-3 py-2.5 text-[0.78rem] text-brand-muted whitespace-nowrap">{formatDateTime(removedAt)}</td>
      <td className="px-3 py-2.5 text-[0.78rem] text-brand-navy">{formatUserLabel(removedBy)}</td>
    </>
  );
}

function ListPanelShell({
  title,
  description,
  search,
  onSearchChange,
  searchPlaceholder,
  statusFilter,
  onStatusFilterChange,
  summary,
  addForm,
  children,
}: {
  title: string;
  description: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
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

      <div className="grid gap-2 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-4 py-3">
        <SummaryCards total={summary.total} active={summary.active} inactive={summary.inactive} />
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="los-input"
        />
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onStatusFilterChange(filter)}
              className={cx(
                'min-h-[30px] cursor-pointer rounded-full border px-3 py-1 text-[0.74rem] font-bold capitalize transition-colors',
                statusFilter === filter
                  ? 'border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.1)] text-brand-blue'
                  : 'border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.85)] text-brand-muted',
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [pincode, setPincode] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byStatus = applyStatusFilter(items, statusFilter);
    if (!needle) return byStatus;
    return byStatus.filter((item) => item.pincode.includes(needle) || (item.reason ?? '').toLowerCase().includes(needle));
  }, [items, search, statusFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);

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
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search pincode or reason"
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
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
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-[rgba(248,250,255,0.96)] text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
          <tr>
            <th className="px-3 py-2">Pincode</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Added by</th>
            <th className="px-3 py-2">Removed</th>
            <th className="px-3 py-2">Removed by</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id} className="border-t border-[rgba(23,44,113,0.06)]">
              <td className="px-3 py-2.5 font-bold text-brand-navy">{item.pincode}</td>
              <td className="px-3 py-2.5"><StatusPill isActive={item.isActive} /></td>
              <AuditCells addedAt={item.addedAt} addedBy={item.addedBy} removedAt={item.removedAt} removedBy={item.removedBy} />
              <td className="px-3 py-2.5 text-right">
                {item.isActive ? (
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
                ) : null}
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-[0.84rem] text-brand-muted">
                No pincodes match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [cityId, setCityId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCities = useMemo(
    () => cities.filter((city) => city.isActive && city.stateIsActive).sort((a, b) => `${a.stateName} ${a.name}`.localeCompare(`${b.stateName} ${b.name}`)),
    [cities],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byStatus = applyStatusFilter(items, statusFilter);
    if (!needle) return byStatus;
    return byStatus.filter((item) => (
      item.cityName.toLowerCase().includes(needle)
      || item.stateName.toLowerCase().includes(needle)
      || item.stateCode.toLowerCase().includes(needle)
      || (item.reason ?? '').toLowerCase().includes(needle)
    ));
  }, [items, search, statusFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);

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
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search city, state, or reason"
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
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
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-[rgba(248,250,255,0.96)] text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
          <tr>
            <th className="px-3 py-2">City</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Added by</th>
            <th className="px-3 py-2">Removed</th>
            <th className="px-3 py-2">Removed by</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id} className="border-t border-[rgba(23,44,113,0.06)]">
              <td className="px-3 py-2.5">
                <strong className="block text-brand-navy">{item.cityName}</strong>
                <span className="text-[0.76rem] text-brand-muted">{item.stateName} ({item.stateCode})</span>
              </td>
              <td className="px-3 py-2.5"><StatusPill isActive={item.isActive} /></td>
              <AuditCells addedAt={item.addedAt} addedBy={item.addedBy} removedAt={item.removedAt} removedBy={item.removedBy} />
              <td className="px-3 py-2.5 text-right">
                {item.isActive ? (
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
                ) : null}
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-[0.84rem] text-brand-muted">
                No cities match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [stateId, setStateId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStates = useMemo(
    () => states.filter((state) => state.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [states],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byStatus = applyStatusFilter(items, statusFilter);
    if (!needle) return byStatus;
    return byStatus.filter((item) => (
      item.stateName.toLowerCase().includes(needle)
      || item.stateCode.toLowerCase().includes(needle)
      || (item.reason ?? '').toLowerCase().includes(needle)
    ));
  }, [items, search, statusFilter]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);

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
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search state or reason"
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
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
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-[rgba(248,250,255,0.96)] text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
          <tr>
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Added by</th>
            <th className="px-3 py-2">Removed</th>
            <th className="px-3 py-2">Removed by</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id} className="border-t border-[rgba(23,44,113,0.06)]">
              <td className="px-3 py-2.5">
                <strong className="block text-brand-navy">{item.stateName}</strong>
                <span className="text-[0.76rem] text-brand-muted">{item.stateCode}</span>
              </td>
              <td className="px-3 py-2.5"><StatusPill isActive={item.isActive} /></td>
              <AuditCells addedAt={item.addedAt} addedBy={item.addedBy} removedAt={item.removedAt} removedBy={item.removedBy} />
              <td className="px-3 py-2.5 text-right">
                {item.isActive ? (
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
                ) : null}
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-[0.84rem] text-brand-muted">
                No states match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
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
