'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  DataTableStatusPill,
  LOS_LISTING_PAGE_SIZE,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { getSettings, type LosSetting, updateSetting } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLosToken,
  IconButton,
  ModalShell,
  SummaryCards,
} from '@/components/eligibility/eligibility-ui';

const BANK_NAME_FUZZ_SCORE_KEY = 'PENNY_DROP_NAME_MATCH_MIN_SCORE';

function isPercentScoreSetting(key: string): boolean {
  return key === BANK_NAME_FUZZ_SCORE_KEY;
}

function SettingModal({
  item,
  onClose,
  onSubmit,
}: {
  item: LosSetting;
  onClose: () => void;
  onSubmit: (data: { value: string; description: string; isActive: boolean }) => Promise<unknown>;
}) {
  const [value, setValue] = useState(item.value);
  const [description, setDescription] = useState(item.description ?? '');
  const [isActive, setIsActive] = useState(item.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percentSetting = isPercentScoreSetting(item.key);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        value: value.trim(),
        description: description.trim(),
        isActive,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save setting.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Edit Setting"
      subtitle="Update the stored value and LOS description. The key is fixed by the application."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Key</span>
          <input className="los-input" value={item.key} readOnly disabled />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">{percentSetting ? 'Max fuzzing score' : 'Value'}</span>
          {percentSetting ? (
            <span className="flex items-center gap-2">
              <input
                className="los-input"
                type="number"
                min={0}
                max={100}
                step={1}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
              />
              <span className="text-[0.88rem] font-bold text-brand-muted">%</span>
            </span>
          ) : (
            <input
              className="los-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={255}
              required
            />
          )}
          {percentSetting ? (
            <span className="text-[0.78rem] text-brand-muted">Allowed range is 0–100%. Bank name scores below this stay In Review at Bank details.</span>
          ) : null}
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Description</span>
          <textarea
            className="los-input min-h-[88px] resize-y"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={255}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span className="text-[0.9rem] font-bold">Active</span>
        </label>

        {error ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] flex-1 cursor-pointer rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent font-bold text-brand-text">
            Cancel
          </button>
          <button type="submit" className="los-btn-primary flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Save Setting'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<LosSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<LosSetting | null>(null);

  const loadSettings = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await getSettings(token);
      setSettings(response);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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
      await loadSettings(token);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSoftToggle(item: LosSetting, nextActive: boolean) {
    if (!window.confirm(`Mark ${item.key} as ${nextActive ? 'active' : 'inactive'}?`)) return;
    await runAction(`setting-${item.id}`, (token) => updateSetting(token, item.id, { isActive: nextActive }));
  }

  const summary = useMemo(() => {
    const total = settings.length;
    const active = settings.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [settings]);

  const columns = useMemo((): DataTableColumn<LosSetting>[] => [
    {
      key: 'key',
      label: 'Key',
      getFilterValue: (item) => item.key,
      getSortValue: (item) => item.key.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search key…' },
      cellClassName: 'font-mono text-[0.82rem] font-bold',
      render: (item) => item.key,
    },
    {
      key: 'value',
      label: 'Value',
      getFilterValue: (item) => item.value,
      getSortValue: (item) => item.value.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search value…' },
      cellClassName: 'font-mono text-[0.82rem]',
      render: (item) =>
        isPercentScoreSetting(item.key) ? `${item.value}%` : item.value,
    },
    {
      key: 'description',
      label: 'Description',
      getFilterValue: (item) => item.description ?? '',
      getSortValue: (item) => (item.description ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search description…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.description?.trim() || '—',
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
      render: (item) => <DataTableStatusPill isActive={item.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <div className="flex items-center gap-2">
          <IconButton title="Edit setting" onClick={() => setEditing(item)} disabled={busyKey === `setting-${item.id}`}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </IconButton>
          {item.isActive ? (
            <IconButton
              title="Deactivate setting"
              tone="danger"
              disabled={busyKey === `setting-${item.id}`}
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
              title="Activate setting"
              tone="success"
              disabled={busyKey === `setting-${item.id}`}
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

        <div>
          <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">Settings</h2>
          <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
            Edit runtime values used by OTP, loan amounts, bureau, and session policy. Inactive rows fall back to the application default.
          </p>
        </div>

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {actionError}
          </div>
        ) : null}

        <DataTable
          items={settings}
          columns={columns}
          getRowKey={(item) => item.id}
          entityLabel="settings"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadSettings()}
          emptyMessage="No settings available."
          pageSize={LOS_LISTING_PAGE_SIZE}
        />
      </div>

      {editing ? (
        <SettingModal
          item={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => runAction(`setting-${editing.id}`, (token) => updateSetting(token, editing.id, data))}
        />
      ) : null}
    </>
  );
}
