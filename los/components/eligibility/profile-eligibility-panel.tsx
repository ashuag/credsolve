'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  getEligibilityCriteria,
  type LosEligibilityCriterion,
  updateEligibilityCriterion,
} from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  cx,
  getLosToken,
  IconButton,
  ModalShell,
  StatusPill,
  SummaryCards,
} from './eligibility-ui';

const REJECTED_CREDIT_ASSESSMENT_GRADES_KEY = 'REJECTED_CREDIT_ASSESSMENT_GRADES';

const CREDIT_ASSESSMENT_GRADES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const CREDIT_ASSESSMENT_GRADE_LABEL: Record<(typeof CREDIT_ASSESSMENT_GRADES)[number], string> = {
  A: 'Credit-active prime',
  B: 'Near-prime active',
  C: 'Mid-prime',
  D: 'Below-average credit',
  E: 'Subprime',
  F: 'High-risk',
  G: 'Very high-risk',
  H: 'Thin-file / NTC / Distressed',
};

function parseCreditAssessmentGrades(value: string): string[] {
  const selected = new Set(
    value
      .split(',')
      .map((part) => part.trim().toUpperCase())
      .filter((part) => CREDIT_ASSESSMENT_GRADES.includes(part as (typeof CREDIT_ASSESSMENT_GRADES)[number])),
  );
  return CREDIT_ASSESSMENT_GRADES.filter((grade) => selected.has(grade));
}

function serializeCreditAssessmentGrades(grades: string[]) {
  return CREDIT_ASSESSMENT_GRADES.filter((grade) => grades.includes(grade)).join(',');
}

function GradeValuePills({ value }: { value: string }) {
  const grades = parseCreditAssessmentGrades(value);
  if (!grades.length) {
    return <span>—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {grades.map((grade) => (
        <span
          key={grade}
          className="inline-flex min-w-[1.6rem] justify-center rounded-[6px] bg-[rgba(239,68,68,0.1)] px-1.5 py-0.5 text-[0.78rem] font-extrabold text-[#991b1b]"
        >
          {grade}
        </span>
      ))}
    </div>
  );
}

function ProfileCriterionModal({
  item,
  onClose,
  onSubmit,
}: {
  item: LosEligibilityCriterion;
  onClose: () => void;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const isGradeRule = item.key === REJECTED_CREDIT_ASSESSMENT_GRADES_KEY;
  const [value, setValue] = useState(item.value);
  const [selectedGrades, setSelectedGrades] = useState(() => parseCreditAssessmentGrades(item.value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGrade(grade: string) {
    setSelectedGrades((current) =>
      current.includes(grade) ? current.filter((selected) => selected !== grade) : [...current, grade],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextValue = isGradeRule ? serializeCreditAssessmentGrades(selectedGrades) : value.trim();
    if (!nextValue) {
      setError(isGradeRule ? 'Select at least one grade, or deactivate the rule instead.' : 'Value cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(nextValue);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save profile eligibility criterion.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={isGradeRule ? 'Edit rejected credit-assessment grades' : 'Edit Profile Eligibility Rule'}
      subtitle={
        isGradeRule
          ? 'Select the CIBIL credit-assessment grades (A–H) that should fail post-BRE. The rule key stays fixed.'
          : 'Update the stored rule value while keeping the internal rule key and label fixed.'
      }
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

        {isGradeRule ? (
          <fieldset className="grid gap-2">
            <legend className="text-[0.9rem] font-bold">Rejected grades</legend>
            <p className="m-0 text-[0.8rem] leading-[1.45] text-brand-muted">
              Applications whose credit-assessment category matches a selected grade are rejected.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CREDIT_ASSESSMENT_GRADES.map((grade) => {
                const checked = selectedGrades.includes(grade);
                return (
                  <label
                    key={grade}
                    className={cx(
                      'flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5',
                      checked
                        ? 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.06)]'
                        : 'border-[rgba(23,44,113,0.1)] bg-white',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => toggleGrade(grade)}
                    />
                    <span className="grid gap-0.5">
                      <span className="text-[0.88rem] font-extrabold tracking-wide">{grade}</span>
                      <span className="text-[0.76rem] leading-[1.35] text-brand-muted">
                        {CREDIT_ASSESSMENT_GRADE_LABEL[grade]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
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
        )}

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

  const scopedCriteria = useMemo(
    () => (breType ? criteria.filter((item) => item.breType === breType) : criteria),
    [breType, criteria],
  );

  const summary = useMemo(() => {
    const total = scopedCriteria.length;
    const active = scopedCriteria.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [scopedCriteria]);

  const pageCopy =
    breType === 'POST_BRE'
      ? {
          title: 'Post BRE',
          description:
            'Manage post-bureau eligibility thresholds used after CIBIL pull, including score floors, DPD windows, enquiry limits, tradeline rules, and rejected credit-assessment grades.',
        }
      : breType === 'PRE_BRE'
        ? {
            title: 'Pre BRE',
            description:
              'Manage pre-bureau eligibility rules applied before CIBIL pull, including age, occupation, gender, and negative serviceability enforcement.',
          }
        : {
            title: 'Profile Eligibility Check',
            description:
              'Manage profile-level eligibility rules used during screening, including stored threshold values and whether each rule is currently enforced.',
          };

  const columns = useMemo((): DataTableColumn<LosEligibilityCriterion>[] => [
    {
      key: 'rule',
      label: 'Rule',
      getFilterValue: (item) => [item.label, item.key, item.description ?? ''].join(' '),
      getSortValue: (item) => item.label.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search rules, labels, keys…' },
      render: (item) => (
        <div className="grid gap-0.5">
          <strong>{item.label}</strong>
          <span className="text-[0.78rem] uppercase tracking-[0.08em] text-brand-muted">{item.key}</span>
          {item.description ? (
            <span className="text-[0.8rem] leading-[1.45] text-brand-muted">{item.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      getFilterValue: (item) => item.value,
      getSortValue: (item) => item.value.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search values…' },
      cellClassName: 'text-brand-muted',
      render: (item) =>
        item.key === REJECTED_CREDIT_ASSESSMENT_GRADES_KEY ? <GradeValuePills value={item.value} /> : item.value,
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
          <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">{pageCopy.title}</h2>
          <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
            {pageCopy.description}
          </p>
        </div>

        <DataTable
          items={scopedCriteria}
          columns={columns}
          getRowKey={(item) => item.id}
          entityLabel="rules"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadCriteria()}
          emptyMessage="No profile eligibility criteria available right now."
          noResultsMessage="No profile eligibility criteria match your filters."
          tableClassName="text-[0.88rem]"
        />
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
