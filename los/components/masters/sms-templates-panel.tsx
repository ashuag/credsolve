'use client';

import {
  ACTIVE_INACTIVE_FILTER_OPTIONS,
  DataTable,
  DataTableStatusPill,
  matchesActiveInactiveFilter,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  getSmsTemplates,
  type LosSmsTemplate,
  updateSmsTemplate,
} from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLosToken,
  IconButton,
  ModalShell,
  SummaryCards,
} from '@/components/eligibility/eligibility-ui';

function SmsTemplateModal({
  item,
  onClose,
  onSubmit,
}: {
  item: LosSmsTemplate;
  onClose: () => void;
  onSubmit: (data: {
    templateId: string;
    bearerToken?: string;
    message: string;
    product: string;
    isActive: boolean;
  }) => Promise<unknown>;
}) {
  const [templateId, setTemplateId] = useState(item.templateId);
  const [bearerToken, setBearerToken] = useState('');
  const [message, setMessage] = useState(item.message);
  const [product, setProduct] = useState(item.product);
  const [isActive, setIsActive] = useState(item.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        templateId: templateId.trim(),
        ...(bearerToken.trim() ? { bearerToken: bearerToken.trim() } : {}),
        message: message.trim(),
        product: product.trim(),
        isActive,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save SMS template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Edit SMS Template"
      subtitle="Update provider template settings. Leave bearer token blank to keep the stored value."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Product</span>
          <input
            className="los-input"
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            maxLength={50}
            required
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Template ID</span>
          <input
            className="los-input"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            maxLength={40}
            required
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Bearer token</span>
          <input
            className="los-input"
            value={bearerToken}
            onChange={(event) => setBearerToken(event.target.value)}
            placeholder={`Current: ${item.bearerToken}`}
            maxLength={255}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.9rem] font-bold">Message</span>
          <textarea
            className="los-input min-h-[120px] resize-y"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            required
          />
          <span className="text-[0.78rem] text-brand-muted">Use &lt;OTP&gt; as the OTP placeholder.</span>
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
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function SmsTemplatesPanel() {
  const [templates, setTemplates] = useState<LosSmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<LosSmsTemplate | null>(null);

  const loadTemplates = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const response = await getSmsTemplates(token);
      setTemplates(response);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load SMS templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

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
      await loadTemplates(token);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSoftToggle(item: LosSmsTemplate, nextActive: boolean) {
    if (!window.confirm(`Mark ${item.product} template as ${nextActive ? 'active' : 'inactive'}?`)) return;
    await runAction(`sms-template-${item.id}`, (token) => updateSmsTemplate(token, item.id, { isActive: nextActive }));
  }

  const summary = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((item) => item.isActive).length;
    return { total, active, inactive: total - active };
  }, [templates]);

  const columns = useMemo((): DataTableColumn<LosSmsTemplate>[] => [
    {
      key: 'product',
      label: 'Product',
      getFilterValue: (item) => item.product,
      getSortValue: (item) => item.product.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search product…' },
      cellClassName: 'font-bold',
      render: (item) => item.product,
    },
    {
      key: 'templateId',
      label: 'Template ID',
      getFilterValue: (item) => item.templateId,
      getSortValue: (item) => item.templateId.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search template ID…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.templateId,
    },
    {
      key: 'message',
      label: 'Message',
      getFilterValue: (item) => item.message,
      getSortValue: (item) => item.message.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search message…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.message,
    },
    {
      key: 'bearerToken',
      label: 'Bearer token',
      getFilterValue: (item) => item.bearerToken,
      getSortValue: (item) => item.bearerToken.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search token…' },
      cellClassName: 'text-brand-muted',
      render: (item) => item.bearerToken,
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
          <IconButton title="Edit SMS template" onClick={() => setEditing(item)} disabled={busyKey === `sms-template-${item.id}`}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </IconButton>
          {item.isActive ? (
            <IconButton
              title="Deactivate SMS template"
              tone="danger"
              disabled={busyKey === `sms-template-${item.id}`}
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
              title="Activate SMS template"
              tone="success"
              disabled={busyKey === `sms-template-${item.id}`}
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
          <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">SMS Templates</h2>
          <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
            Manage SMS provider templates used for OTP and other outbound messages.
          </p>
        </div>

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {actionError}
          </div>
        ) : null}

        <DataTable
          items={templates}
          columns={columns}
          getRowKey={(item) => item.id}
          entityLabel="SMS templates"
          loading={loading}
          error={fetchError}
          onRetry={() => void loadTemplates()}
          emptyMessage="No SMS templates available."
        />
      </div>

      {editing ? (
        <SmsTemplateModal
          item={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => runAction(`sms-template-${editing.id}`, (token) => updateSmsTemplate(token, editing.id, data))}
        />
      ) : null}
    </>
  );
}
