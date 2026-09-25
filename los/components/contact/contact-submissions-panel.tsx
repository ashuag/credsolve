'use client';

import {
  DataTable,
  isoDateTimestamp,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getContactSubmissions,
  type LosContactSubmission,
  markContactSubmissionRead,
} from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { cx } from '@/lib/cx';

const READ_FILTER_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
] as const;

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article
      className="rounded-[10px] border border-[rgba(15,39,72,0.1)] px-4 py-3"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
    >
      <span className="block text-[0.78rem] text-brand-muted">{label}</span>
      <strong className="mt-0.5 block text-[1.55rem] font-extrabold leading-none tracking-[-0.03em]">
        {value}
      </strong>
    </article>
  );
}

function DetailModal({
  item,
  onClose,
}: {
  item: LosContactSubmission;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,66,0.42)] p-4 backdrop-blur-[4px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Contact submission detail"
    >
      <div
        className="w-full max-w-[560px] rounded-[20px] border border-[rgba(15,39,72,0.12)] p-6 shadow-[0_28px_70px_rgba(15,39,72,0.22)]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,247,255,0.96))' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-brand-blue">
              Contact Submission
            </span>
            <h2 className="m-0 text-[1.3rem] font-extrabold leading-[1.1] tracking-[-0.04em]">{item.subject}</h2>
            <p className="m-0 mt-1 text-[0.85rem] leading-[1.4] text-brand-muted">
              {formatDateTime(item.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(15,39,72,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy"
            aria-label="Close"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-[90px_1fr] gap-2 text-[0.88rem]">
            <span className="font-bold text-brand-muted">Name</span>
            <span className="font-bold">{item.name}</span>
            <span className="font-bold text-brand-muted">Email</span>
            <a href={`mailto:${item.email}`} className="font-bold text-brand-blue">{item.email}</a>
            <span className="font-bold text-brand-muted">Phone</span>
            {item.phone?.trim() ? (
              <a href={`tel:+91${item.phone}`} className="font-bold text-brand-blue">
                +91 {item.phone}
              </a>
            ) : (
              <span className="font-bold text-brand-muted">—</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <span className="text-[0.88rem] font-bold text-brand-muted">Message</span>
            <div className="max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-[rgba(15,39,72,0.1)] bg-white p-4 text-[0.9rem] leading-[1.6]">
              {item.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactSubmissionsPanel() {
  const [submissions, setSubmissions] = useState<LosContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<LosContactSubmission | null>(null);

  const load = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getLosToken();
    if (!token) {
      setFetchError('Session expired - please log in again.');
      setLoading(false);
      return;
    }
    try {
      const rows = await getContactSubmissions(token);
      setSubmissions(rows);
      setFetchError(null);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load contact submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleRead(item: LosContactSubmission, nextRead: boolean) {
    const token = getLosToken();
    if (!token) {
      setActionError('Session expired - please log in again.');
      return;
    }
    setBusyKey(item.uuid);
    setActionError(null);
    try {
      await markContactSubmissionRead(token, item.uuid, nextRead);
      await load(token);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusyKey(null);
    }
  }

  function openDetail(item: LosContactSubmission) {
    setViewing(item);
    if (!item.isRead) void handleToggleRead(item, true);
  }

  const summary = useMemo(() => {
    const total = submissions.length;
    const unread = submissions.filter((item) => !item.isRead).length;
    return { total, unread, read: total - unread };
  }, [submissions]);

  const columns = useMemo((): DataTableColumn<LosContactSubmission>[] => [
    {
      key: 'name',
      label: 'Name',
      getFilterValue: (item) => item.name,
      getSortValue: (item) => item.name.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (item) => (
        <span className="inline-flex items-center gap-2 font-bold">
          {!item.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-blue" aria-hidden /> : null}
          {item.name}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      getFilterValue: (item) => item.email,
      getSortValue: (item) => item.email.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search email…' },
      cellClassName: 'text-brand-muted',
      render: (item) => (
        <a href={`mailto:${item.email}`} className="text-brand-blue">{item.email}</a>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      getFilterValue: (item) => item.phone ?? '',
      getSortValue: (item) => item.phone ?? '',
      filter: { type: 'text', placeholder: 'Search phone…' },
      cellClassName: 'whitespace-nowrap text-brand-muted',
      render: (item) => (
        item.phone?.trim() ? (
          <a href={`tel:+91${item.phone}`} className="text-brand-blue">
            +91 {item.phone}
          </a>
        ) : (
          '—'
        )
      ),
    },
    {
      key: 'subject',
      label: 'Subject',
      getFilterValue: (item) => item.subject,
      getSortValue: (item) => item.subject.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search subject…' },
      cellClassName: 'max-w-[280px] truncate text-brand-muted',
      render: (item) => <span title={item.subject}>{item.subject}</span>,
    },
    {
      key: 'received',
      label: 'Received',
      getFilterValue: (item) => item.createdAt,
      getSortValue: (item) => isoDateTimestamp(item.createdAt),
      filter: { type: 'date' },
      cellClassName: 'whitespace-nowrap text-brand-muted',
      render: (item) => formatDateTime(item.createdAt),
    },
    {
      key: 'status',
      label: 'Status',
      getFilterValue: (item) => (item.isRead ? 'read' : 'unread'),
      getSortValue: (item) => (item.isRead ? 1 : 0),
      filter: {
        type: 'select',
        options: [...READ_FILTER_OPTIONS],
        matches: (item, value) => {
          if (value === 'read') return item.isRead;
          if (value === 'unread') return !item.isRead;
          return true;
        },
      },
      render: (item) => (
        <span
          className={cx(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold',
            item.isRead
              ? 'bg-[rgba(15,39,72,0.08)] text-brand-muted'
              : 'bg-[rgba(34,197,94,0.12)] text-brand-blue',
          )}
        >
          {item.isRead ? 'Read' : 'Unread'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filter: false,
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openDetail(item)}
            className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.08)] px-3 text-[0.8rem] font-bold text-brand-blue"
          >
            View
          </button>
          <button
            type="button"
            disabled={busyKey === item.uuid}
            onClick={() => void handleToggleRead(item, !item.isRead)}
            className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text disabled:opacity-50"
          >
            {busyKey === item.uuid ? '...' : item.isRead ? 'Mark unread' : 'Mark read'}
          </button>
        </div>
      ),
    },
  ], [busyKey]);

  return (
    <>
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Unread" value={summary.unread} />
          <SummaryCard label="Read" value={summary.read} />
        </div>

        {actionError ? (
          <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
            {actionError}
          </div>
        ) : null}

        <div>
          <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">Contact Us Messages</h2>
          <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
            Messages submitted from the public Contact Us form on the customer website.
          </p>
        </div>

        <DataTable
          items={submissions}
          columns={columns}
          getRowKey={(item) => item.uuid}
          entityLabel="messages"
          loading={loading}
          error={fetchError}
          onRetry={() => void load()}
          emptyMessage="No contact submissions available right now."
          noResultsMessage="No contact submissions match your filters."
          renderRowClassName={(item) => (!item.isRead ? 'bg-[rgba(34,197,94,0.04)]' : undefined)}
          tableClassName="text-[0.88rem]"
          initialSort={{ key: 'received', dir: 'desc' }}
        />
      </div>

      {viewing ? <DetailModal item={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  );
}
