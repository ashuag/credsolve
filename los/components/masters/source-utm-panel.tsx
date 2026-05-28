'use client';

import {
  createUtmCampaign,
  createUtmMedium,
  createUtmSource,
  getMasters,
  type LosLeadSourceMaster,
  type LosUtmTagMaster,
  updateUtmCampaign,
  updateUtmMedium,
  updateUtmSource,
} from '@/lib/api/masters';
import { getLosToken } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type UtmKind = 'sources' | 'mediums' | 'campaigns';

const UTM_LABELS: Record<UtmKind, { title: string; singular: string; placeholder: string; create: typeof createUtmSource }> = {
  sources: { title: 'UTM Source', singular: 'source', placeholder: 'e.g. google', create: createUtmSource },
  mediums: { title: 'UTM Medium', singular: 'medium', placeholder: 'e.g. cpc', create: createUtmMedium },
  campaigns: { title: 'UTM Campaign', singular: 'campaign', placeholder: 'e.g. summer-sale', create: createUtmCampaign },
};

type UtmRow = LosUtmTagMaster & { kind: UtmKind };
type GroupedUtmRow = {
  leadSourceId: number;
  leadSourceName: string;
  source: UtmRow | null;
  medium: UtmRow | null;
  campaign: UtmRow | null;
};

function IconActionButton({
  title,
  tone,
  onClick,
  disabled,
  children,
}: {
  title: string;
  tone: 'default' | 'danger' | 'success';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[rgba(239,68,68,0.22)] text-[#9f1c1c]'
      : tone === 'success'
        ? 'border-[rgba(34,197,94,0.24)] text-[#166534]'
        : 'border-[rgba(23,44,113,0.12)] text-brand-navy';
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[8px] border bg-white ${toneClass} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
      <span className="sr-only">{title}</span>
    </button>
  );
}

export function SourceUtmPanel({
  mode = 'list',
  editKind,
  editId,
}: {
  mode?: 'list' | 'create' | 'edit';
  editKind?: UtmKind;
  editId?: number;
}) {
  const router = useRouter();
  const [leadSources, setLeadSources] = useState<LosLeadSourceMaster[]>([]);
  const [utmSources, setUtmSources] = useState<LosUtmTagMaster[]>([]);
  const [utmMediums, setUtmMediums] = useState<LosUtmTagMaster[]>([]);
  const [utmCampaigns, setUtmCampaigns] = useState<LosUtmTagMaster[]>([]);
  const [leadSourceId, setLeadSourceId] = useState(0);
  const [newSourceName, setNewSourceName] = useState('');
  const [newMediumName, setNewMediumName] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [actionKindBySourceId, setActionKindBySourceId] = useState<Record<number, UtmKind>>({});
  const [editName, setEditName] = useState('');
  const [copiedSourceId, setCopiedSourceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (!leadSourceId && leadSources[0]) {
      setLeadSourceId(leadSources[0].id);
    }
  }, [leadSourceId, leadSources]);

  const rows = useMemo<UtmRow[]>(() => {
    return [
      ...utmSources.map((row) => ({ ...row, kind: 'sources' as const })),
      ...utmMediums.map((row) => ({ ...row, kind: 'mediums' as const })),
      ...utmCampaigns.map((row) => ({ ...row, kind: 'campaigns' as const })),
    ];
  }, [utmCampaigns, utmMediums, utmSources]);

  const groupedRows = useMemo<GroupedUtmRow[]>(() => {
    const map = new Map<number, GroupedUtmRow>();
    for (const row of rows) {
      const existing = map.get(row.leadSourceId) ?? {
        leadSourceId: row.leadSourceId,
        leadSourceName: row.leadSourceName,
        source: null,
        medium: null,
        campaign: null,
      };
      if (row.kind === 'sources') existing.source = row;
      if (row.kind === 'mediums') existing.medium = row;
      if (row.kind === 'campaigns') existing.campaign = row;
      map.set(row.leadSourceId, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.leadSourceName.localeCompare(b.leadSourceName));
  }, [rows]);

  const editTarget = useMemo(() => {
    if (mode !== 'edit' || !editKind || !editId) return null;
    return rows.find((row) => row.kind === editKind && row.id === editId) ?? null;
  }, [editId, editKind, mode, rows]);

  useEffect(() => {
    if (editTarget) setEditName(editTarget.name);
  }, [editTarget]);

  useEffect(() => {
    setActionKindBySourceId((prev) => {
      const next: Record<number, UtmKind> = { ...prev };
      for (const group of groupedRows) {
        const availableKinds = [
          group.source ? 'sources' : null,
          group.medium ? 'mediums' : null,
          group.campaign ? 'campaigns' : null,
        ].filter(Boolean) as UtmKind[];
        if (availableKinds.length === 0) continue;
        if (!next[group.leadSourceId] || !availableKinds.includes(next[group.leadSourceId]!)) {
          next[group.leadSourceId] = availableKinds[0]!;
        }
      }
      return next;
    });
  }, [groupedRows]);

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

  async function submitCreateUtm(event: FormEvent) {
    event.preventDefault();
    if (!leadSourceId) return;
    const source = newSourceName.trim();
    const medium = newMediumName.trim();
    const campaign = newCampaignName.trim();
    if (!source && !medium && !campaign) return;

    await withBusy(async (token) => {
      if (source) {
        await createUtmSource(token, { leadSourceId, name: source });
      }
      if (medium) {
        await createUtmMedium(token, { leadSourceId, name: medium });
      }
      if (campaign) {
        await createUtmCampaign(token, { leadSourceId, name: campaign });
      }
    });
    setNewSourceName('');
    setNewMediumName('');
    setNewCampaignName('');
  }

  async function copyUtmParams(group: GroupedUtmRow) {
    const params = new URLSearchParams();
    if (group.source?.name) params.set('utm_source', group.source.name);
    if (group.medium?.name) params.set('utm_medium', group.medium.name);
    if (group.campaign?.name) params.set('utm_campaign', group.campaign.name);
    const query = params.toString();
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      setCopiedSourceId(group.leadSourceId);
      window.setTimeout(() => setCopiedSourceId((current) => (current === group.leadSourceId ? null : current)), 1400);
    } catch {
      /* ignore clipboard failure */
    }
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

      {mode === 'create' ? (
        <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
          <div className="border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
            <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">Create New UTM</h2>
            <p className="m-0 mt-1 text-[0.84rem] text-brand-muted">
              Select source, then add one or more UTM params together.
            </p>
          </div>
          <form className="grid gap-3 px-4 py-4 md:grid-cols-2" onSubmit={(event) => void submitCreateUtm(event)}>
            <label className="grid gap-1">
              <span className="text-[0.78rem] font-bold text-brand-muted">Lead Source</span>
              <select className="los-input" value={leadSourceId || ''} onChange={(event) => setLeadSourceId(Number(event.target.value))}>
                {leadSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <div />
            <label className="grid gap-1">
              <span className="text-[0.78rem] font-bold text-brand-muted">UTM Source</span>
              <input
                className="los-input"
                value={newSourceName}
                placeholder="e.g. google"
                onChange={(event) => setNewSourceName(event.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[0.78rem] font-bold text-brand-muted">UTM Medium</span>
              <input
                className="los-input"
                value={newMediumName}
                placeholder="e.g. cpc"
                onChange={(event) => setNewMediumName(event.target.value)}
              />
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-[0.78rem] font-bold text-brand-muted">UTM Campaign</span>
              <input
                className="los-input"
                value={newCampaignName}
                placeholder="e.g. summer-sale"
                onChange={(event) => setNewCampaignName(event.target.value)}
              />
            </label>
            <div className="flex gap-2 md:col-span-2">
              <Link href="/masters/source-utm" className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-navy no-underline">
                Back
              </Link>
              <button
                type="submit"
                className="los-btn-primary"
                disabled={busy || !leadSourceId || (!newSourceName.trim() && !newMediumName.trim() && !newCampaignName.trim())}
              >
                Create UTM
              </button>
            </div>
          </form>
        </section>
      ) : mode === 'edit' ? (
        <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
          <div className="border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
            <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">Edit UTM</h2>
            <p className="m-0 mt-1 text-[0.84rem] text-brand-muted">Update a UTM tag for selected lead source.</p>
          </div>
          {!editTarget ? (
            <div className="px-4 py-6 text-[0.9rem] text-brand-muted">UTM tag not found.</div>
          ) : (
            <form
              className="grid gap-3 px-4 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = editName.trim();
                if (!trimmed) return;
                void withBusy(async (token) => {
                  if (editTarget.kind === 'sources') await updateUtmSource(token, editTarget.id, { name: trimmed });
                  else if (editTarget.kind === 'mediums') await updateUtmMedium(token, editTarget.id, { name: trimmed });
                  else await updateUtmCampaign(token, editTarget.id, { name: trimmed });
                  router.push('/masters/source-utm');
                });
              }}
            >
              <div className="grid gap-1">
                <span className="text-[0.78rem] font-bold text-brand-muted">Lead Source</span>
                <input className="los-input bg-[rgba(248,250,255,0.8)]" value={editTarget.leadSourceName} readOnly />
              </div>
              <div className="grid gap-1">
                <span className="text-[0.78rem] font-bold text-brand-muted">UTM Type</span>
                <input className="los-input bg-[rgba(248,250,255,0.8)]" value={UTM_LABELS[editTarget.kind].title} readOnly />
              </div>
              <div className="grid gap-1">
                <span className="text-[0.78rem] font-bold text-brand-muted">UTM Value</span>
                <input className="los-input" value={editName} onChange={(event) => setEditName(event.target.value)} minLength={2} maxLength={100} required />
              </div>
              <div className="flex gap-2">
                <Link href="/masters/source-utm" className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-navy no-underline">
                  Back
                </Link>
                <button type="submit" className="los-btn-primary" disabled={busy || !editName.trim()}>
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
            <div>
              <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">UTM Listing with Source</h2>
              <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
                All UTM types listed with source mapping. Edit and activate/deactivate via actions.
              </p>
            </div>
            <Link href="/masters/source-utm/create" className="los-btn-primary no-underline">
              + Create New
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.86rem]">
              <thead>
                <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                  {['Lead Source', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Action'].map((heading) => (
                    <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <tr key={group.leadSourceId} className="border-b border-[rgba(23,44,113,0.05)]">
                    <td className="px-4 py-3 font-semibold text-brand-text">{group.leadSourceName}</td>
                    {[group.source, group.medium, group.campaign].map((entry, idx) => (
                      <td key={`${group.leadSourceId}-${idx}`} className="px-4 py-3">
                        {entry ? (
                          <span className="font-semibold text-brand-navy">{entry.name}</span>
                        ) : (
                          <span className="text-brand-muted">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {(() => {
                        const selectedKind = actionKindBySourceId[group.leadSourceId] ?? 'sources';
                        const target =
                          selectedKind === 'sources'
                            ? group.source
                            : selectedKind === 'mediums'
                              ? group.medium
                              : group.campaign;
                        const options = [
                          group.source ? { value: 'sources' as const, label: 'Source' } : null,
                          group.medium ? { value: 'mediums' as const, label: 'Medium' } : null,
                          group.campaign ? { value: 'campaigns' as const, label: 'Campaign' } : null,
                        ].filter(Boolean) as Array<{ value: UtmKind; label: string }>;

                        if (!target || options.length === 0) return <span className="text-brand-muted">—</span>;

                        return (
                          <div className="flex items-center gap-2">
                            <select
                              className="los-input h-8 min-w-[98px] py-1 text-[0.78rem]"
                              value={selectedKind}
                              onChange={(event) =>
                                setActionKindBySourceId((prev) => ({
                                  ...prev,
                                  [group.leadSourceId]: event.target.value as UtmKind,
                                }))
                              }
                            >
                              {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Link
                              href={`/masters/source-utm/edit?kind=${selectedKind}&id=${target.id}`}
                              title="Edit"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.12)] text-brand-navy no-underline"
                            >
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                              <span className="sr-only">Edit</span>
                            </Link>
                            <IconActionButton
                              title={target.isActive ? 'Deactivate' : 'Activate'}
                              tone={target.isActive ? 'danger' : 'success'}
                              onClick={() => {
                                void withBusy((token) => {
                                  if (target.kind === 'sources') return updateUtmSource(token, target.id, { isActive: !target.isActive });
                                  if (target.kind === 'mediums') return updateUtmMedium(token, target.id, { isActive: !target.isActive });
                                  return updateUtmCampaign(token, target.id, { isActive: !target.isActive });
                                });
                              }}
                              disabled={busy}
                            >
                              {target.isActive ? (
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              ) : (
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                            </IconActionButton>
                            <button
                              type="button"
                              title="Copy UTM params"
                              className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.12)] px-2.5 text-[0.72rem] font-bold text-brand-navy"
                              onClick={() => void copyUtmParams(group)}
                              disabled={busy || (!group.source && !group.medium && !group.campaign)}
                            >
                              {copiedSourceId === group.leadSourceId ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
                {groupedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-7 text-center text-brand-muted">No UTM tags found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
