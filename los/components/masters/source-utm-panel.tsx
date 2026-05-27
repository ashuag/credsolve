'use client';

import {
  LOS_LEAD_SOURCE_TYPES,
  createLeadSource,
  createUtmCampaign,
  createUtmMedium,
  createUtmSource,
  getMasters,
  type LosLeadSourceMaster,
  type LosLeadSourceType,
  type LosUtmTagMaster,
  updateLeadSource,
  updateUtmCampaign,
  updateUtmMedium,
  updateUtmSource,
} from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

function formatLeadSourceType(type: LosLeadSourceType) {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type UtmKind = 'sources' | 'mediums' | 'campaigns';

const UTM_LABELS: Record<UtmKind, { title: string; placeholder: string; create: typeof createUtmSource }> = {
  sources: { title: 'UTM Source tags', placeholder: 'e.g. google', create: createUtmSource },
  mediums: { title: 'UTM Medium tags', placeholder: 'e.g. cpc', create: createUtmMedium },
  campaigns: { title: 'UTM Campaign tags', placeholder: 'e.g. summer-sale', create: createUtmCampaign },
};

function UtmTagSection({
  kind,
  items,
  leadSources,
  busy,
  onCreate,
  onSave,
  onToggleActive,
}: {
  kind: UtmKind;
  items: LosUtmTagMaster[];
  leadSources: LosLeadSourceMaster[];
  busy: boolean;
  onCreate: (leadSourceId: number, name: string) => Promise<void>;
  onSave: (id: number, name: string) => Promise<void>;
  onToggleActive: (item: LosUtmTagMaster) => Promise<void>;
}) {
  const meta = UTM_LABELS[kind];
  const [leadSourceId, setLeadSourceId] = useState<number>(leadSources[0]?.id ?? 0);
  const [name, setName] = useState('');
  const [draftNames, setDraftNames] = useState<Record<number, string>>({});

  useEffect(() => {
    setDraftNames(Object.fromEntries(items.map((item) => [item.id, item.name])));
  }, [items]);

  useEffect(() => {
    if (!leadSourceId && leadSources[0]) {
      setLeadSourceId(leadSources[0].id);
    }
  }, [leadSourceId, leadSources]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!leadSourceId || !trimmed) return;
    await onCreate(leadSourceId, trimmed);
    setName('');
  }

  return (
    <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
      <div className="border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
        <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">{meta.title}</h2>
        <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
          Stored in <code className="text-[0.8rem]">utm_{kind === 'sources' ? 'source' : kind.slice(0, -1)}</code> table, linked to a lead source.
        </p>
      </div>

      <form
        className="grid gap-2 border-b border-[rgba(23,44,113,0.07)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        onSubmit={(event) => void handleCreate(event)}
      >
        <select
          className="los-input"
          value={leadSourceId || ''}
          onChange={(event) => setLeadSourceId(Number(event.target.value))}
          disabled={leadSources.length === 0}
        >
          {leadSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        <input
          className="los-input"
          placeholder={meta.placeholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={leadSources.length === 0}
        />
        <button type="submit" className="los-btn-primary" disabled={busy || leadSources.length === 0}>
          Add
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.86rem]">
          <thead>
            <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
              {['Lead source', 'Tag', 'Status', 'Actions'].map((heading) => (
                <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[rgba(23,44,113,0.05)]">
                <td className="px-4 py-3 text-brand-muted">{item.leadSourceName}</td>
                <td className="px-4 py-3">
                  <input
                    className="los-input"
                    value={draftNames[item.id] ?? item.name}
                    onChange={(event) =>
                      setDraftNames((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={item.isActive ? 'text-[#166534]' : 'text-[#991b1b]'}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-white px-3 text-[0.78rem] font-bold text-brand-navy"
                      disabled={busy}
                      onClick={() => void onSave(item.id, (draftNames[item.id] ?? item.name).trim())}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-white px-3 text-[0.78rem] font-bold text-brand-navy"
                      disabled={busy}
                      onClick={() => void onToggleActive(item)}
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-brand-muted">
                  No {kind} configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SourceUtmPanel() {
  const [leadSources, setLeadSources] = useState<LosLeadSourceMaster[]>([]);
  const [utmSources, setUtmSources] = useState<LosUtmTagMaster[]>([]);
  const [utmMediums, setUtmMediums] = useState<LosUtmTagMaster[]>([]);
  const [utmCampaigns, setUtmCampaigns] = useState<LosUtmTagMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<LosLeadSourceType>('ADS');
  const [draftSourceNames, setDraftSourceNames] = useState<Record<number, string>>({});
  const [draftSourceTypes, setDraftSourceTypes] = useState<Record<number, LosLeadSourceType>>({});

  const loadData = useCallback(async () => {
    const token = getLosToken();
    if (!token) {
      setError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const masters = await getMasters(token);
      setLeadSources(masters.leadSources);
      setUtmSources(masters.utmSources ?? []);
      setUtmMediums(masters.utmMediums ?? []);
      setUtmCampaigns(masters.utmCampaigns ?? []);
      setDraftSourceNames(Object.fromEntries(masters.leadSources.map((item) => [item.id, item.name])));
      setDraftSourceTypes(Object.fromEntries(masters.leadSources.map((item) => [item.id, item.type])));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load source/UTM data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeLeadSources = useMemo(() => leadSources.filter((item) => item.isActive).length, [leadSources]);

  async function withBusy(task: (token: string) => Promise<unknown>) {
    const token = getLosToken();
    if (!token) {
      setError('Session expired - please log in again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await task(token);
      await loadData();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCreateLeadSource(event: FormEvent) {
    event.preventDefault();
    const name = newSourceName.trim();
    if (!name) return;
    await withBusy((token) => createLeadSource(token, { name, type: newSourceType }));
    setNewSourceName('');
    setNewSourceType('ADS');
  }

  if (loading) {
    return (
      <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-white p-6 text-brand-muted">
        Loading source and UTM panel...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
          {error}
        </div>
      ) : null}

      <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
          <div>
            <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">Lead Sources</h2>
            <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">Acquisition sources in `lead_source` table.</p>
          </div>
          <span className="rounded-full border border-[rgba(23,44,113,0.1)] bg-white px-3 py-1 text-[0.74rem] font-bold text-brand-muted">
            {activeLeadSources}/{leadSources.length} active
          </span>
        </div>

        <form
          className="grid gap-2 border-b border-[rgba(23,44,113,0.07)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
          onSubmit={(event) => void submitCreateLeadSource(event)}
        >
          <input
            className="los-input"
            placeholder="Add lead source name"
            value={newSourceName}
            onChange={(event) => setNewSourceName(event.target.value)}
          />
          <select
            className="los-input"
            value={newSourceType}
            onChange={(event) => setNewSourceType(event.target.value as LosLeadSourceType)}
          >
            {LOS_LEAD_SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatLeadSourceType(type)}
              </option>
            ))}
          </select>
          <button type="submit" className="los-btn-primary" disabled={busy}>
            Add Lead Source
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.86rem]">
            <thead>
              <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                {['Source', 'Type', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadSources.map((item) => (
                <tr key={item.id} className="border-b border-[rgba(23,44,113,0.05)]">
                  <td className="px-4 py-3">
                    <input
                      className="los-input"
                      value={draftSourceNames[item.id] ?? item.name}
                      onChange={(event) =>
                        setDraftSourceNames((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="los-input"
                      value={draftSourceTypes[item.id] ?? item.type}
                      onChange={(event) =>
                        setDraftSourceTypes((prev) => ({
                          ...prev,
                          [item.id]: event.target.value as LosLeadSourceType,
                        }))
                      }
                    >
                      {LOS_LEAD_SOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {formatLeadSourceType(type)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={item.isActive ? 'text-[#166534]' : 'text-[#991b1b]'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-white px-3 text-[0.78rem] font-bold text-brand-navy"
                        disabled={busy}
                        onClick={() =>
                          void withBusy((token) =>
                            updateLeadSource(token, item.id, {
                              name: (draftSourceNames[item.id] ?? item.name).trim(),
                              type: draftSourceTypes[item.id] ?? item.type,
                            }),
                          )
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-white px-3 text-[0.78rem] font-bold text-brand-navy"
                        disabled={busy}
                        onClick={() =>
                          void withBusy((token) =>
                            updateLeadSource(token, item.id, { isActive: !item.isActive }),
                          )
                        }
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <UtmTagSection
        kind="sources"
        items={utmSources}
        leadSources={leadSources}
        busy={busy}
        onCreate={(leadSourceId, name) => withBusy((token) => createUtmSource(token, { leadSourceId, name }))}
        onSave={(id, name) => withBusy((token) => updateUtmSource(token, id, { name }))}
        onToggleActive={(item) => withBusy((token) => updateUtmSource(token, item.id, { isActive: !item.isActive }))}
      />

      <UtmTagSection
        kind="mediums"
        items={utmMediums}
        leadSources={leadSources}
        busy={busy}
        onCreate={(leadSourceId, name) => withBusy((token) => createUtmMedium(token, { leadSourceId, name }))}
        onSave={(id, name) => withBusy((token) => updateUtmMedium(token, id, { name }))}
        onToggleActive={(item) => withBusy((token) => updateUtmMedium(token, item.id, { isActive: !item.isActive }))}
      />

      <UtmTagSection
        kind="campaigns"
        items={utmCampaigns}
        leadSources={leadSources}
        busy={busy}
        onCreate={(leadSourceId, name) => withBusy((token) => createUtmCampaign(token, { leadSourceId, name }))}
        onSave={(id, name) => withBusy((token) => updateUtmCampaign(token, id, { name }))}
        onToggleActive={(item) => withBusy((token) => updateUtmCampaign(token, item.id, { isActive: !item.isActive }))}
      />
    </div>
  );
}
