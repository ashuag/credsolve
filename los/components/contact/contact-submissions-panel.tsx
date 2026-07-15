'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getContactSubmissions,
  type LosContactSubmission,
  markContactSubmissionRead,
} from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { cx } from '@/lib/cx';

type ReadFilter = 'all' | 'unread' | 'read';

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
      className="rounded-[10px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
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
        className="w-full max-w-[560px] rounded-[20px] border border-[rgba(23,44,113,0.12)] p-6 shadow-[0_28px_70px_rgba(23,44,113,0.22)]"
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
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy"
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
            <div className="max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white p-4 text-[0.9rem] leading-[1.6]">
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
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return submissions.filter((item) => {
      if (readFilter === 'read' && !item.isRead) return false;
      if (readFilter === 'unread' && item.isRead) return false;
      if (term === '') return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        (item.phone ?? '').toLowerCase().includes(term) ||
        item.subject.toLowerCase().includes(term) ||
        item.message.toLowerCase().includes(term)
      );
    });
  }, [submissions, search, readFilter]);

  const summary = useMemo(() => {
    const total = submissions.length;
    const unread = submissions.filter((item) => !item.isRead).length;
    return { total, unread, read: total - unread };
  }, [submissions]);

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

        {fetchError ? (
          <div className="rounded-[12px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-6 text-[0.9rem] text-[#8d3434]">
            {fetchError}
          </div>
        ) : loading ? (
          <div className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.9)] p-8 text-center text-[0.88rem] text-brand-muted">
            Loading contact submissions...
          </div>
        ) : (
          <section
            className="overflow-hidden rounded-[16px] border border-[rgba(23,44,113,0.1)]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,246,255,0.95))' }}
          >
            <div className="border-b border-[rgba(23,44,113,0.07)] px-5 py-4">
              <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em]">Contact Us Messages</h2>
              <p className="m-0 mt-1 max-w-[70ch] text-[0.86rem] leading-[1.5] text-brand-muted">
                Messages submitted from the public Contact Us form on the customer website.
              </p>
            </div>

            <div className="grid gap-3 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <input
                type="search"
                placeholder="Search name, email, phone, subject, message..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="los-input"
              />
              <div className="flex flex-wrap gap-2">
                {(['all', 'unread', 'read'] as ReadFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReadFilter(value)}
                    className={cx(
                      'min-h-[34px] cursor-pointer rounded-full border px-3 py-1 text-[0.78rem] font-bold capitalize transition-colors',
                      readFilter === value
                        ? 'border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.1)] text-brand-blue'
                        : 'border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.85)] text-brand-muted',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.88rem]">
                <thead>
                  <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.82)] text-left">
                    {['Name', 'Email', 'Phone', 'Subject', 'Received', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, index) => (
                    <tr
                      key={item.uuid}
                      className={cx(
                        'border-b border-[rgba(23,44,113,0.05)]',
                        index === filtered.length - 1 && 'border-b-0',
                        !item.isRead && 'bg-[rgba(20,150,243,0.04)]',
                      )}
                    >
                      <td className="px-4 py-3 font-bold">
                        <span className="inline-flex items-center gap-2">
                          {!item.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-blue" aria-hidden /> : null}
                          {item.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        <a href={`mailto:${item.email}`} className="text-brand-blue">{item.email}</a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-brand-muted">
                        {item.phone?.trim() ? (
                          <a href={`tel:+91${item.phone}`} className="text-brand-blue">
                            +91 {item.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-brand-muted" title={item.subject}>{item.subject}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-brand-muted">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold',
                            item.isRead
                              ? 'bg-[rgba(23,44,113,0.08)] text-brand-muted'
                              : 'bg-[rgba(20,150,243,0.12)] text-brand-blue',
                          )}
                        >
                          {item.isRead ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(item)}
                            className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.08)] px-3 text-[0.8rem] font-bold text-brand-blue"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === item.uuid}
                            onClick={() => void handleToggleRead(item, !item.isRead)}
                            className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text disabled:opacity-50"
                          >
                            {busyKey === item.uuid ? '...' : item.isRead ? 'Mark unread' : 'Mark read'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                        No contact submissions match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {viewing ? <DetailModal item={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  );
}
