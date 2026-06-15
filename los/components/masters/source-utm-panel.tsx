'use client';

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

const UTM_COLS: { key: keyof LosSourceUtmMaster; label: string }[] = [
  { key: 'leadSourceName', label: 'Lead Source' },
  { key: 'utmSource',      label: 'Source' },
  { key: 'utmCampaign',    label: 'Campaign' },
  { key: 'utmMedium',      label: 'Medium' },
  { key: 'utmTerm',        label: 'Term' },
  { key: 'utmContent',     label: 'Content' },
];

function formatLeadSourceType(type: LosLeadSourceType) {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

  // create / edit form
  const [leadSourceId, setLeadSourceId] = useState(0);
  const [formSource,   setFormSource]   = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formTerm,     setFormTerm]     = useState('');
  const [formMedium,   setFormMedium]   = useState('');
  const [formContent,  setFormContent]  = useState('');

  // list filters + pagination
  const [sourceFilters, setSourceFilters] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page,     setPage]    = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

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
        utmSource:   src || undefined,
        utmCampaign: cmp || undefined,
        utmTerm:     trm || undefined,
        utmMedium:   med || undefined,
        utmContent:  cnt || undefined,
      });
    });
    setFormSource(''); setFormCampaign(''); setFormTerm(''); setFormMedium(''); setFormContent('');
  }

  async function copyUrl(row: LosSourceUtmMaster) {
    const params = new URLSearchParams();
    if (row.utmSource)   params.set('utm_source',   row.utmSource);
    if (row.utmCampaign) params.set('utm_campaign',  row.utmCampaign);
    if (row.utmTerm)     params.set('utm_term',      row.utmTerm);
    if (row.utmMedium)   params.set('utm_medium',    row.utmMedium);
    if (row.utmContent)  params.set('utm_content',   row.utmContent);
    if (!params.size) return;
    const base = (process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL ?? '').replace(/\/$/, '');
    try {
      await navigator.clipboard.writeText(`${base}/?${params.toString()}`);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1600);
    } catch { /* ignore */ }
  }

  // ── filtered + paginated rows ─────────────────────────────────────────────
  const filteredSources = useMemo(() => {
    return leadSources.filter((row) => {
      const nameFilter = (sourceFilters.name ?? '').toLowerCase().trim();
      const typeFilter = (sourceFilters.type ?? '').toLowerCase().trim();
      const statusFilter = sourceFilters.isActive ?? '';
      if (nameFilter && !row.name.toLowerCase().includes(nameFilter)) return false;
      if (typeFilter && !row.type.toLowerCase().includes(typeFilter) && !formatLeadSourceType(row.type).toLowerCase().includes(typeFilter)) return false;
      if (statusFilter === 'true' && !row.isActive) return false;
      if (statusFilter === 'false' && row.isActive) return false;
      return true;
    });
  }, [leadSources, sourceFilters]);

  const filtered = useMemo(() => {
    return sourceUtms.filter((row) =>
      UTM_COLS.every(({ key }) => {
        const f = (filters[key] ?? '').toLowerCase().trim();
        if (!f) return true;
        return String(row[key] ?? '').toLowerCase().includes(f);
      }),
    );
  }, [sourceUtms, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function setFilter(key: string, val: string) {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }

  if (loading) {
    return <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-white p-6 text-brand-muted">Loading…</div>;
  }

  // ── shared form field style ───────────────────────────────────────────────
  const inp = 'los-input';

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
          {error}
        </div>
      )}

      {/* ── CREATE ────────────────────────────────────────────────────────── */}
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
              { label: 'UTM Source',   val: formSource,   set: setFormSource,   ph: 'e.g. google' },
              { label: 'UTM Campaign', val: formCampaign, set: setFormCampaign, ph: 'e.g. summer-sale' },
              { label: 'UTM Medium',   val: formMedium,   set: setFormMedium,   ph: 'e.g. cpc' },
              { label: 'UTM Term',     val: formTerm,     set: setFormTerm,     ph: 'e.g. personal+loan' },
              { label: 'UTM Content',  val: formContent,  set: setFormContent,  ph: 'e.g. banner-v1' },
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

      {/* ── EDIT ──────────────────────────────────────────────────────────── */}
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
                    utmSource:   formSource   || undefined,
                    utmCampaign: formCampaign || undefined,
                    utmTerm:     formTerm     || undefined,
                    utmMedium:   formMedium   || undefined,
                    utmContent:  formContent  || undefined,
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
                { label: 'UTM Source',   val: formSource,   set: setFormSource,   ph: 'e.g. google' },
                { label: 'UTM Campaign', val: formCampaign, set: setFormCampaign, ph: 'e.g. summer-sale' },
                { label: 'UTM Medium',   val: formMedium,   set: setFormMedium,   ph: 'e.g. cpc' },
                { label: 'UTM Term',     val: formTerm,     set: setFormTerm,     ph: 'e.g. personal+loan' },
                { label: 'UTM Content',  val: formContent,  set: setFormContent,  ph: 'e.g. banner-v1' },
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

      {/* ── LIST ──────────────────────────────────────────────────────────── */}
      {mode === 'list' && (
        <>
        <section className="overflow-hidden rounded-[18px] border border-[rgba(23,44,113,0.1)] bg-white shadow-[0_2px_16px_rgba(23,44,113,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(135deg,rgba(23,44,113,0.05),rgba(59,130,246,0.04))] px-5 py-4">
            <div>
              <h2 className="m-0 text-[1.05rem] font-extrabold text-brand-navy">Lead Sources</h2>
              <p className="m-0 mt-0.5 text-[0.81rem] text-brand-muted">
                {filteredSources.length} of {leadSources.length} source{leadSources.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/masters/lead-sources" className="inline-flex min-h-[38px] items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-navy no-underline hover:bg-[rgba(235,242,255,0.8)]">
              Manage sources
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.85rem]">
              <thead>
                <tr className="bg-[rgba(23,44,113,0.04)]">
                  {['Name', 'Type', 'Status'].map((label) => (
                    <th key={label} className="border-b border-[rgba(23,44,113,0.08)] px-4 py-[10px] text-left text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                      {label}
                    </th>
                  ))}
                </tr>
                <tr className="bg-[rgba(248,250,255,0.9)]">
                  <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2">
                    <input
                      value={sourceFilters.name ?? ''}
                      onChange={(e) => setSourceFilters((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Filter…"
                      className="w-full rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white px-2.5 py-1.5 text-[0.78rem] text-brand-text placeholder-brand-muted outline-none focus:border-[rgba(23,44,113,0.4)]"
                    />
                  </td>
                  <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2">
                    <select
                      value={sourceFilters.type ?? ''}
                      onChange={(e) => setSourceFilters((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white px-2 py-1.5 text-[0.78rem] text-brand-text outline-none focus:border-[rgba(23,44,113,0.4)]"
                    >
                      <option value="">All types</option>
                      {LOS_LEAD_SOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>{formatLeadSourceType(type)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2">
                    <select
                      value={sourceFilters.isActive ?? ''}
                      onChange={(e) => setSourceFilters((prev) => ({ ...prev, isActive: e.target.value }))}
                      className="w-full rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white px-2 py-1.5 text-[0.78rem] text-brand-text outline-none focus:border-[rgba(23,44,113,0.4)]"
                    >
                      <option value="">All</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((row, i) => (
                  <tr key={row.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[rgba(248,250,255,0.55)]'} transition-colors hover:bg-[rgba(235,242,255,0.7)]`}>
                    <td className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3 font-bold text-brand-navy">{row.name}</td>
                    <td className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3 text-brand-muted">{formatLeadSourceType(row.type)}</td>
                    <td className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.74rem] font-bold ${row.isActive ? 'bg-[rgba(34,197,94,0.1)] text-[#15803d]' : 'bg-[rgba(156,163,175,0.15)] text-[#6b7280]'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-[#22c55e]' : 'bg-[#9ca3af]'}`} />
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSources.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-[0.88rem] text-brand-muted">
                      {Object.values(sourceFilters).some(Boolean) ? 'No sources match your filters.' : 'No lead sources found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[rgba(23,44,113,0.1)] bg-white shadow-[0_2px_16px_rgba(23,44,113,0.07)]">
          {/* header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[linear-gradient(135deg,rgba(23,44,113,0.05),rgba(59,130,246,0.04))] px-5 py-4">
            <div>
              <h2 className="m-0 text-[1.05rem] font-extrabold text-brand-navy">UTM Configurations</h2>
              <p className="m-0 mt-0.5 text-[0.81rem] text-brand-muted">
                {filtered.length} of {sourceUtms.length} UTM record{sourceUtms.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/masters/source-utm/create" className="los-btn-primary no-underline">
              + Create New
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.85rem]">
              <thead>
                {/* column labels */}
                <tr className="bg-[rgba(23,44,113,0.04)]">
                  {UTM_COLS.map(({ key, label }) => (
                    <th key={key} className="border-b border-[rgba(23,44,113,0.08)] px-4 py-[10px] text-left text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                      {label}
                    </th>
                  ))}
                  <th className="border-b border-[rgba(23,44,113,0.08)] px-4 py-[10px] text-left text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Status</th>
                  <th className="border-b border-[rgba(23,44,113,0.08)] px-4 py-[10px] text-left text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Action</th>
                </tr>
                {/* filter row */}
                <tr className="bg-[rgba(248,250,255,0.9)]">
                  {UTM_COLS.map(({ key }) => (
                    <td key={key} className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2">
                      <input
                        value={filters[key] ?? ''}
                        onChange={(e) => setFilter(key, e.target.value)}
                        placeholder="Filter…"
                        className="w-full rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white px-2.5 py-1.5 text-[0.78rem] text-brand-text placeholder-brand-muted outline-none focus:border-[rgba(23,44,113,0.4)] focus:ring-0"
                      />
                    </td>
                  ))}
                  <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2">
                    <select
                      value={filters['isActive'] ?? ''}
                      onChange={(e) => setFilter('isActive', e.target.value)}
                      className="w-full rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white px-2 py-1.5 text-[0.78rem] text-brand-text outline-none focus:border-[rgba(23,44,113,0.4)]"
                    >
                      <option value="">All</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                  <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2">
                    {Object.values(filters).some(Boolean) && (
                      <button
                        type="button"
                        onClick={() => { setFilters({}); setPage(1); }}
                        className="rounded-[7px] border border-[rgba(239,68,68,0.22)] bg-white px-3 py-1.5 text-[0.75rem] font-bold text-[#9f1c1c] hover:bg-[rgba(254,242,242,0.8)]"
                      >
                        Clear
                      </button>
                    )}
                  </td>
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => {
                  const hasParams = !!(row.utmSource || row.utmCampaign || row.utmTerm || row.utmMedium || row.utmContent);
                  const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-[rgba(248,250,255,0.55)]';
                  return (
                    <tr key={row.id} className={`${rowBg} transition-colors hover:bg-[rgba(235,242,255,0.7)]`}>
                      <td className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3 font-bold text-brand-navy">
                        {row.leadSourceName}
                      </td>
                      {([row.utmSource, row.utmCampaign, row.utmMedium, row.utmTerm, row.utmContent] as (string | null)[]).map((val, idx) => (
                        <td key={idx} className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3">
                          {val ? (
                            <span className="inline-block rounded-[6px] bg-[rgba(59,130,246,0.08)] px-2 py-0.5 font-semibold text-[0.81rem] text-[#1e40af]">
                              {val}
                            </span>
                          ) : (
                            <span className="text-[0.8rem] text-brand-muted">—</span>
                          )}
                        </td>
                      ))}
                      <td className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.74rem] font-bold ${row.isActive ? 'bg-[rgba(34,197,94,0.1)] text-[#15803d]' : 'bg-[rgba(156,163,175,0.15)] text-[#6b7280]'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-[#22c55e]' : 'bg-[#9ca3af]'}`} />
                          {row.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="border-b border-[rgba(23,44,113,0.04)] px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* Edit */}
                          <Link
                            href={`/masters/source-utm/edit?id=${row.id}`}
                            title="Edit"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-white text-brand-navy no-underline hover:bg-[rgba(235,242,255,0.8)]"
                          >
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                            <span className="sr-only">Edit</span>
                          </Link>
                          {/* Toggle active */}
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
                          {/* Copy URL */}
                          <button
                            type="button"
                            onClick={() => void copyUrl(row)}
                            disabled={busy || !hasParams}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[0.75rem] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${copiedId === row.id ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(240,253,244,0.9)] text-[#15803d]' : 'border-[rgba(23,44,113,0.18)] bg-white text-brand-navy hover:bg-[rgba(235,242,255,0.8)]'}`}
                          >
                            {copiedId === row.id ? (
                              <>
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                                Copied
                              </>
                            ) : (
                              <>
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[0.88rem] text-brand-muted">
                      {Object.values(filters).some(Boolean) ? 'No records match your filters.' : 'No source UTMs found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.6)] px-5 py-3">
            <div className="flex items-center gap-2 text-[0.8rem] text-brand-muted">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white px-2 py-1 text-[0.8rem] text-brand-text outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="ml-1">
                {filtered.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} of {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white text-brand-navy disabled:opacity-30"
                title="First page"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white text-brand-navy disabled:opacity-30"
                title="Previous"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '…' ? (
                    <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-[0.8rem] text-brand-muted">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p as number)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-[7px] border text-[0.8rem] font-semibold transition-colors ${p === safePage ? 'border-brand-navy bg-brand-navy text-white' : 'border-[rgba(23,44,113,0.14)] bg-white text-brand-navy hover:bg-[rgba(235,242,255,0.8)]'}`}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white text-brand-navy disabled:opacity-30"
                title="Next"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[rgba(23,44,113,0.14)] bg-white text-brand-navy disabled:opacity-30"
                title="Last page"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
              </button>
            </div>
          </div>
        </section>
        </>
      )}
    </div>
  );
}
