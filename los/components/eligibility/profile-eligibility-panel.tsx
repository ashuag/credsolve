'use client';

import {
  getEligibilityCriteria,
  type LosEligibilityCriterion,
  updateEligibilityCriterion,
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

function ProfileCriterionModal({
  item,
  onClose,
  onSubmit,
}: {
  item: LosEligibilityCriterion;
  onClose: () => void;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(item.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(value);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save profile eligibility criterion.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Edit Profile Eligibility Rule"
      subtitle="Update the stored rule value while keeping the internal rule key and label fixed."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">Rule label</span>
          <input className="los-input bg-[rgba(248,250,255,0.8)]" value={item.label} readOnly />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">Rule key</span>
          <input className="los-input bg-[rgba(248,250,255,0.8)]" value={item.key} readOnly />
        </label>

        {item.description ? (
          <div className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.72)] p-[12px_14px] text-[0.84rem] leading-[1.45] text-brand-muted">
            {item.description}
          </div>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Rule value</span>
          <input
            className="los-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            minLength={1}
            maxLength={100}
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
            {saving ? 'Saving...' : 'Save Value'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ProfileEligibilityPanel({
  breType,
}: {
  breType?: 'PRE_BRE' | 'POST_BRE';
} = {}) {
  const [criteria, setCriteria] = useState<LosEligibilityCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<LosEligibilityCriterion | null>(null);

  const loadCriteria = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await getEligibilityCriteria(token);
      setCriteria(response);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load profile eligibility criteria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCriteria();
  }, [loadCriteria]);

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
      await loadCriteria(token);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSoftToggle(item: LosEligibilityCriterion, isActive: boolean) {
    if (!window.confirm(`Mark ${item.label} as ${isActive ? 'active' : 'inactive'}?`)) return;
    await runAction(`criterion-${item.id}`, (token) => updateEligibilityCriterion(token, item.id, { isActive }));
  }

  const filteredCriteria = useMemo(() => {
    const term = search.trim().toLowerCase();
    const scoped = breType ? criteria.filter((item) => item.breType === breType) : criteria;
    const filtered = scoped.filter((item) => (
      term === ''
      || item.key.toLowerCase().includes(term)
      || item.label.toLowerCase().includes(term)
      || item.value.toLowerCase().includes(term)
      || item.description?.toLowerCase().includes(term)
    ));

    return applyStatusFilter(filtered, statusFilter);
  }, [breType, criteria, search, statusFilter]);

  const summary = useMemo(() => {
    const scoped = breType ? criteria.filter((item) => item.breType === breType) : criteria;
    const total = scoped.length;
    const active = scoped.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [breType, criteria]);

  const pageCopy =
    breType === 'POST_BRE'
      ? {
          title: 'Post BRE',
          description:
            'Manage post-bureau eligibility thresholds used after CIBIL pull, including score floors, DPD windows, enquiry limits, and tradeline rules.',
          loading: 'Loading post-BRE criteria...',
        }
      : breType === 'PRE_BRE'
        ? {
            title: 'Pre BRE',
            description:
              'Manage pre-bureau eligibility rules applied before CIBIL pull, including age, occupation, gender, and negative serviceability enforcement.',
            loading: 'Loading pre-BRE criteria...',
          }
        : {
            title: 'Profile Eligibility Check',
            description:
              'Manage profile-level eligibility rules used during screening, including stored threshold values and whether each rule is currently enforced.',
            loading: 'Loading profile eligibility criteria...',
          };

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
            {pageCopy.loading}
          </div>
        ) : (
          <PageShell
            title={pageCopy.title}
            description={pageCopy.description}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search rules, labels, keys, values..."
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          >
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                  {['Rule', 'Value', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCriteria.map((item, index) => (
                  <tr key={item.id} className={cx('border-b border-[rgba(23,44,113,0.05)]', index === filteredCriteria.length - 1 && 'border-b-0')}>
                    <td className="px-4 py-3">
                      <div className="grid gap-0.5">
                        <strong>{item.label}</strong>
                        <span className="text-[0.78rem] uppercase tracking-[0.08em] text-brand-muted">{item.key}</span>
                        {item.description ? (
                          <span className="text-[0.8rem] leading-[1.45] text-brand-muted">{item.description}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-muted">{item.value}</td>
                    <td className="px-4 py-3"><StatusPill isActive={item.isActive} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <IconButton title="Edit profile eligibility rule" onClick={() => setEditing(item)} disabled={busyKey === `criterion-${item.id}`}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </IconButton>
                        {item.isActive ? (
                          <IconButton
                            title="Deactivate profile eligibility rule"
                            tone="danger"
                            disabled={busyKey === `criterion-${item.id}`}
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
                            title="Activate profile eligibility rule"
                            tone="success"
                            disabled={busyKey === `criterion-${item.id}`}
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
                {filteredCriteria.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No profile eligibility criteria match the current search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </PageShell>
        )}
      </div>

      {editing ? (
        <ProfileCriterionModal
          item={editing}
          onClose={() => setEditing(null)}
          onSubmit={(value) => runAction(`criterion-${editing.id}`, (token) => updateEligibilityCriterion(token, editing.id, { value }))}
        />
      ) : null}
    </>
  );
}
