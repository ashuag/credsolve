'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  DataTableStatusPill,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  createSourceUtm,
  getMasters,
  LOS_LEAD_SOURCE_TYPES,
  type LosLeadSourceMaster,
  type LosLeadSourceType,
  type LosSourceUtmMaster,
  updateSourceUtm,
} from '@/lib/api/masters';
import { getLosToken } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatLeadSourceType(type: LosLeadSourceType) {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function UtmChip({ value }: { value: string | null }) {
  if (!value) return <span className="text-[0.8rem] text-brand-muted">—</span>;
  return (
    <span className="inline-block rounded-[6px] bg-[rgba(59,130,246,0.08)] px-2 py-0.5 font-semibold text-[0.81rem] text-[#1e40af]">
      {value}
    </span>
  );
}

export function SourceUtmPanel({
  mode = 'list',
  editId,
}: {
  mode?: 'list' | 'create' | 'edit';
  editId?: number;
}) {
  const router = useRouter();
  const [leadSources, setLeadSources] = useState<LosLeadSourceMaster[]>([]);
  const [sourceUtms, setSourceUtms] = useState<LosSourceUtmMaster[]>([]);

  const [leadSourceId, setLeadSourceId] = useState(0);
  const [formSource, setFormSource] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formTerm, setFormTerm] = useState('');
  const [formMedium, setFormMedium] = useState('');
  const [formContent, setFormContent] = useState('');

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    const token = getLosToken();
    if (!token) { setError('Session expired - please log in again.'); setLoading(false); return; }
    try {
      const masters = await getMasters(token);
      setLeadSources(masters.leadSources);
      setSourceUtms(masters.sourceUtms ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { if (!leadSourceId && leadSources[0]) setLeadSourceId(leadSources[0].id); }, [leadSourceId, leadSources]);

  const editTarget = mode === 'edit' && editId ? (sourceUtms.find((r) => r.id === editId) ?? null) : null;
  useEffect(() => {
    if (editTarget) {
      setFormSource(editTarget.utmSource ?? '');
      setFormCampaign(editTarget.utmCampaign ?? '');
      setFormTerm(editTarget.utmTerm ?? '');
      setFormMedium(editTarget.utmMedium ?? '');
      setFormContent(editTarget.utmContent ?? '');
    }
  }, [editTarget]);

  async function withBusy(task: (token: string) => Promise<unknown>) {
    const token = getLosToken();
    if (!token) { setError('Session expired.'); return; }
    setBusy(true); setError(null);
    try { await task(token); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!leadSourceId) return;
    const src = formSource.trim(), cmp = formCampaign.trim(), trm = formTerm.trim(), med = formMedium.trim(), cnt = formContent.trim();
    if (!src && !cmp && !trm && !med && !cnt) return;
    await withBusy(async (token) => {
      await createSourceUtm(token, {
        leadSourceId,
        utmSource: src || undefined,
        utmCampaign: cmp || undefined,
        utmTerm: trm || undefined,
        utmMedium: med || undefined,
        utmContent: cnt || undefined,
      });
    });
    setFormSource(''); setFormCampaign(''); setFormTerm(''); setFormMedium(''); setFormContent('');
  }

  async function copyUrl(row: LosSourceUtmMaster) {
    const params = new URLSearchParams();
    if (row.utmSource) params.set('utm_source', row.utmSource);
    if (row.utmCampaign) params.set('utm_campaign', row.utmCampaign);
    if (row.utmTerm) params.set('utm_term', row.utmTerm);
    if (row.utmMedium) params.set('utm_medium', row.utmMedium);
    if (row.utmContent) params.set('utm_content', row.utmContent);
    if (!params.size) return;
    const base = (process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL ?? '').replace(/\/$/, '');
    try {
      await navigator.clipboard.writeText(`${base}/?${params.toString()}`);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1600);
    } catch { /* ignore */ }
  }

  const leadSourceColumns = useMemo((): DataTableColumn<LosLeadSourceMaster>[] => [
    {
      key: 'name',
      label: 'Name',
      getFilterValue: (row) => row.name,
      getSortValue: (row) => row.name.toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      cellClassName: 'font-bold text-brand-navy',
      render: (row) => row.name,
    },
    {
      key: 'type',
      label: 'Type',
      getFilterValue: (row) => row.type,
      getSortValue: (row) => row.type.toLowerCase(),
      filter: {
        type: 'select',
        options: LOS_LEAD_SOURCE_TYPES.map((type) => ({ value: type, label: formatLeadSourceType(type) })),
        matches: (row, value) => row.type === value,
      },
      cellClassName: 'text-brand-muted',
      render: (row) => formatLeadSourceType(row.type),
    },
    {
      key: 'status',
      label: 'Status',
      getFilterValue: (row) => (row.isActive ? 'active' : 'inactive'),
      getSortValue: (row) => (row.isActive ? 0 : 1),
      filter: {
        type: 'select',
        options: [...ACTIVE_INACTIVE_FILTER_OPTIONS],
        matches: (row, value) => matchesActiveInactiveFilter(row.isActive, value),
      },
      render: (row) => <DataTableStatusPill isActive={row.isActive} />,
    },
  ], []);

  const utmColumns = useMemo((): DataTableColumn<LosSourceUtmMaster>[] => [
    {
      key: 'leadSourceName',
      label: 'Lead Source',
      getFilterValue: (row) => row.leadSourceName,
      getSortValue: (row) => row.leadSourceName.toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      cellClassName: 'font-bold text-brand-navy',
      render: (row) => row.leadSourceName,
    },
    {
      key: 'utmSource',
      label: 'Source',
      getFilterValue: (row) => row.utmSource ?? '',
      getSortValue: (row) => (row.utmSource ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      render: (row) => <UtmChip value={row.utmSource} />,
    },
    {
      key: 'utmCampaign',
      label: 'Campaign',
      getFilterValue: (row) => row.utmCampaign ?? '',
      getSortValue: (row) => (row.utmCampaign ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      render: (row) => <UtmChip value={row.utmCampaign} />,
    },
    {
      key: 'utmMedium',
      label: 'Medium',
      getFilterValue: (row) => row.utmMedium ?? '',
      getSortValue: (row) => (row.utmMedium ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      render: (row) => <UtmChip value={row.utmMedium} />,
    },
    {
      key: 'utmTerm',
      label: 'Term',
      getFilterValue: (row) => row.utmTerm ?? '',
      getSortValue: (row) => (row.utmTerm ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      render: (row) => <UtmChip value={row.utmTerm} />,
    },
    {
      key: 'utmContent',
      label: 'Content',
      getFilterValue: (row) => row.utmContent ?? '',
      getSortValue: (row) => (row.utmContent ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Filter…' },
      render: (row) => <UtmChip value={row.utmContent} />,
    },
    {
      key: 'status',
      label: 'Status',
      getFilterValue: (row) => (row.isActive ? 'active' : 'inactive'),
      getSortValue: (row) => (row.isActive ? 0 : 1),
      filter: {
        type: 'select',
        options: [...ACTIVE_INACTIVE_FILTER_OPTIONS],
        matches: (row, value) => matchesActiveInactiveFilter(row.isActive, value),
      },
      render: (row) => <DataTableStatusPill isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Action',
      sortable: false,
      filter: false,
      render: (row) => {
        const hasParams = !!(row.utmSource || row.utmCampaign || row.utmTerm || row.utmMedium || row.utmContent);
        return (
          <div className="flex items-center gap-1.5">
            <Link
              href={`/masters/source-utm/edit?id=${row.id}`}
              title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-white text-brand-navy no-underline hover:bg-[rgba(235,242,255,0.8)]"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 0L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              <span className="sr-only">Edit</span>
            </Link>
            <button
              type="button"
              title={row.isActive ? 'Deactivate' : 'Activate'}
              onClick={() => void withBusy((t) => updateSourceUtm(t, row.id, { isActive: !row.isActive }))}
              disabled={busy}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-[8px] border bg-white disabled:opacity-50 ${row.isActive ? 'border-[rgba(239,68,68,0.22)] text-[#dc2626] hover:bg-[rgba(254,242,242,0.8)]' : 'border-[rgba(34,197,94,0.24)] text-[#16a34a] hover:bg-[rgba(240,253,244,0.8)]'}`}
            >
              {row.isActive ? (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              <span className="sr-only">{row.isActive ? 'Deactivate' : 'Activate'}</span>
            </button>
            <button
              type="button"
              onClick={() => void copyUrl(row)}
              disabled={busy || !hasParams}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[0.75rem] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${copiedId === row.id ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(240,253,244,0.9)] text-[#15803d]' : 'border-[rgba(23,44,113,0.18)] bg-white text-brand-navy hover:bg-[rgba(235,242,255,0.8)]'}`}
            >
              {copiedId === row.id ? 'Copied' : 'Copy'}
            </button>
          </div>
        );
      },
    },
  ], [busy, copiedId]);

  const inp = 'los-input';

  if (loading && mode === 'list') {
    return <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-white p-6 text-brand-muted">Loading…</div>;
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
          {error}
        </div>
      )}

      {mode === 'create' && (
        <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
          <div className="border-b border-[rgba(23,44,113,0.07)] px-5 py-4">
            <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">Create Source UTM</h2>
            <p className="m-0 mt-1 text-[0.84rem] text-brand-muted">Select a lead source and fill in the UTM parameters.</p>
          </div>
          <form className="grid gap-4 px-5 py-5 md:grid-cols-2" onSubmit={(e) => void submitCreate(e)}>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-[0.78rem] font-bold text-brand-muted">Lead Source</span>
              <select className={inp} value={leadSourceId || ''} onChange={(e) => setLeadSourceId(Number(e.target.value))}>
                {leadSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {[
              { label: 'UTM Source', val: formSource, set: setFormSource, ph: 'e.g. google' },
              { label: 'UTM Campaign', val: formCampaign, set: setFormCampaign, ph: 'e.g. summer-sale' },
              { label: 'UTM Medium', val: formMedium, set: setFormMedium, ph: 'e.g. cpc' },
              { label: 'UTM Term', val: formTerm, set: setFormTerm, ph: 'e.g. personal+loan' },
              { label: 'UTM Content', val: formContent, set: setFormContent, ph: 'e.g. banner-v1' },
            ].map(({ label, val, set, ph }) => (
              <label key={label} className="grid gap-1">
                <span className="text-[0.78rem] font-bold text-brand-muted">{label}</span>
                <input className={inp} value={val} placeholder={ph} onChange={(e) => set(e.target.value)} />
              </label>
            ))}
            <div className="flex gap-2 md:col-span-2">
              <Link href="/masters/source-utm" className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-navy no-underline">Back</Link>
              <button type="submit" className="los-btn-primary" disabled={busy || !leadSourceId || (!formSource.trim() && !formCampaign.trim() && !formTerm.trim() && !formMedium.trim() && !formContent.trim())}>
                Create
              </button>
            </div>
          </form>
        </section>
      )}

      {mode === 'edit' && (
        <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))]">
          <div className="border-b border-[rgba(23,44,113,0.07)] px-5 py-4">
            <h2 className="m-0 text-[1.02rem] font-extrabold text-brand-navy">Edit Source UTM</h2>
            <p className="m-0 mt-1 text-[0.84rem] text-brand-muted">Update UTM parameters for this lead source.</p>
          </div>
          {!editTarget ? (
            <div className="px-5 py-6 text-[0.9rem] text-brand-muted">Source UTM not found.</div>
          ) : (
            <form
              className="grid gap-4 px-5 py-5 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void withBusy(async (token) => {
                  await updateSourceUtm(token, editTarget.id, {
                    utmSource: formSource || undefined,
                    utmCampaign: formCampaign || undefined,
                    utmTerm: formTerm || undefined,
                    utmMedium: formMedium || undefined,
                    utmContent: formContent || undefined,
                  });
                  router.push('/masters/source-utm');
                });
              }}
            >
              <div className="grid gap-1 md:col-span-2">
                <span className="text-[0.78rem] font-bold text-brand-muted">Lead Source</span>
                <input className={`${inp} bg-[rgba(248,250,255,0.8)]`} value={editTarget.leadSourceName} readOnly />
              </div>
              {[
                { label: 'UTM Source', val: formSource, set: setFormSource, ph: 'e.g. google' },
                { label: 'UTM Campaign', val: formCampaign, set: setFormCampaign, ph: 'e.g. summer-sale' },
                { label: 'UTM Medium', val: formMedium, set: setFormMedium, ph: 'e.g. cpc' },
                { label: 'UTM Term', val: formTerm, set: setFormTerm, ph: 'e.g. personal+loan' },
                { label: 'UTM Content', val: formContent, set: setFormContent, ph: 'e.g. banner-v1' },
              ].map(({ label, val, set, ph }) => (
                <label key={label} className="grid gap-1">
                  <span className="text-[0.78rem] font-bold text-brand-muted">{label}</span>
                  <input className={inp} value={val} placeholder={ph} onChange={(e) => set(e.target.value)} />
                </label>
              ))}
              <div className="flex gap-2 md:col-span-2">
                <Link href="/masters/source-utm" className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-navy no-underline">Back</Link>
                <button type="submit" className="los-btn-primary" disabled={busy}>Save Changes</button>
              </div>
            </form>
          )}
        </section>
      )}

      {mode === 'list' && (
        <>
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-[1.05rem] font-extrabold text-brand-navy">Lead Sources</h2>
                <p className="m-0 mt-0.5 text-[0.81rem] text-brand-muted">
                  {leadSources.length} source{leadSources.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Link href="/masters/lead-sources" className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-navy no-underline hover:bg-[rgba(235,242,255,0.8)]">
                Manage sources
              </Link>
            </div>
            <DataTable
              items={leadSources}
              columns={leadSourceColumns}
              getRowKey={(row) => row.id}
              entityLabel="lead sources"
              showPagination={false}
              emptyMessage="No lead sources found."
            />
          </section>

          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-[1.05rem] font-extrabold text-brand-navy">UTM Configurations</h2>
                <p className="m-0 mt-0.5 text-[0.81rem] text-brand-muted">
                  {sourceUtms.length} UTM record{sourceUtms.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Link href="/masters/source-utm/create" className="los-btn-primary no-underline">
                + Create New
              </Link>
            </div>
            <DataTable
              items={sourceUtms}
              columns={utmColumns}
              getRowKey={(row) => row.id}
              entityLabel="UTM records"
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              emptyMessage="No source UTMs found."
              minWidth="960px"
            />
          </section>
        </>
      )}
    </div>
  );
}
