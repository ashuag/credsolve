'use client';

import { getLoanDetails, type LosLoanDetails } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

function formatINR(value: string | null | undefined) {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isOverdue = s.includes('OVERDUE');
  const isClosed = s.includes('CLOSED') || s.includes('WRITE');
  const isActive = s === 'ACTIVE' || s.includes('DISBURS');
  const style = isOverdue
    ? { background: 'rgba(239,68,68,0.14)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.28)' }
    : isClosed
      ? { background: 'rgba(16,185,129,0.14)', color: '#047857', border: '1px solid rgba(16,185,129,0.3)' }
      : isActive
        ? { background: 'rgba(14,165,233,0.14)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.28)' }
        : { background: 'rgba(99,102,241,0.12)', color: '#4338ca', border: '1px solid rgba(99,102,241,0.22)' };
  const display =
    isClosed && !s.includes('WRITE')
      ? 'Paid fully'
      : isOverdue
        ? 'Overdue'
        : label;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold" style={style}>
      {display}
    </span>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{label}</span>
      <div className="text-[0.92rem] font-bold text-brand-text break-words">{value ?? '—'}</div>
    </div>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }) {
  const color = tone === 'good' ? '#047857' : tone === 'warn' ? '#b45309' : '#1c347d';
  return (
    <div className="rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white px-4 py-3">
      <div className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{label}</div>
      <div className="mt-1.5 text-[1.35rem] font-extrabold tracking-tight" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(23,44,113,0.07)] px-5 py-3.5">
        <h2 className="m-0 text-[0.95rem] font-extrabold text-brand-navy">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function LoanDetailsPanel({ loanUuid }: { loanUuid: string }) {
  const [row, setRow] = useState<LosLoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setRow(await getLoanDetails(token, loanUuid));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loan details.');
    } finally {
      setLoading(false);
    }
  }, [loanUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-[120px] rounded-[16px] bg-[rgba(23,44,113,0.06)]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[84px] rounded-[14px] bg-[rgba(23,44,113,0.06)]" />
          ))}
        </div>
        <div className="h-[280px] rounded-[16px] bg-[rgba(23,44,113,0.06)]" />
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="rounded-[16px] border border-[rgba(239,68,68,0.25)] bg-[#fef2f2] p-6 max-w-xl">
        <strong className="text-[#b91c1c]">Unable to load this loan.</strong>
        <p className="mt-2 mb-0 text-[0.9rem] text-[#991b1b]">{error ?? 'Loan not found.'}</p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/loans"
            className="inline-flex h-9 items-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-4 text-[0.84rem] font-bold text-brand-text no-underline"
          >
            Back to loans
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="h-9 rounded-[8px] bg-[#1c347d] px-4 text-[0.84rem] font-bold text-[#ffc519]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const name = formatPersonName(row.fullName, 'Borrower (name pending)');
  const maturityTone = row.daysToMaturity < 0 ? 'warn' : row.daysToMaturity <= 7 ? 'warn' : 'default';

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-gradient-to-br from-white to-[#f4f8ff] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill label={row.loanStatusLabel} code={row.loanStatusCode} />
              <span className="text-[0.72rem] font-bold text-brand-muted">
                App status · {row.applicationStatusLabel}
              </span>
            </div>
            <h1 className="m-0 text-[clamp(1.4rem,2.5vw,1.85rem)] font-extrabold tracking-tight text-brand-navy">
              {row.loanNumber}
            </h1>
            <p className="mt-1 mb-0 text-[0.92rem] font-semibold text-brand-muted">
              {name} · {row.mobileNumber}
              {row.email ? ` · ${row.email}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/loans"
              className="inline-flex h-9 items-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-3 text-[0.82rem] font-bold text-brand-text no-underline hover:bg-[rgba(20,150,243,0.06)]"
            >
              ← All loans
            </Link>
            <Link
              href={`/applications/${row.applicationUuid}`}
              className="inline-flex h-9 items-center rounded-[8px] border border-[rgba(23,44,113,0.14)] px-3 text-[0.82rem] font-bold text-brand-blue no-underline hover:bg-[rgba(20,150,243,0.06)]"
            >
              Open application
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="h-9 rounded-[8px] border border-[rgba(23,44,113,0.14)] px-3 text-[0.82rem] font-bold text-brand-text hover:bg-[rgba(20,150,243,0.06)]"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Principal" value={formatINR(row.principalAmount)} />
        <Metric label="Net disbursed" value={formatINR(row.netDisbursedAmount)} tone="good" />
        <Metric label="Total repayable" value={formatINR(row.totalRepaymentAmount)} />
        <Metric
          label="Outstanding"
          value={formatINR(row.outstandingAmount)}
          tone={Number(row.outstandingAmount) > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Loan terms">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Loan number" value={<span className="font-mono">{row.loanNumber}</span>} />
            <Field label="Application no." value={<span className="font-mono">{row.applicationNumber}</span>} />
            <Field label="Interest rate" value={`${row.interestRate}% / day`} />
            <Field label="Interest amount" value={formatINR(row.interestAmount)} />
            <Field label="Processing fee" value={formatINR(row.processingFeeAmount)} />
            <Field label="GST" value={formatINR(row.gstAmount)} />
            <Field label="Tenure" value={row.expectedRepaymentDays != null ? `${row.expectedRepaymentDays} days` : '—'} />
            <Field label="Purpose" value={row.purposeOfLoan} />
            <Field label="Disbursed at" value={formatDateTime(row.disbursedAt)} />
            <Field label="Maturity date" value={formatDate(row.loanMaturityDate)} />
            <Field
              label="Days to maturity"
              value={
                row.daysToMaturity < 0
                  ? `${Math.abs(row.daysToMaturity)} day(s) overdue`
                  : `${row.daysToMaturity} day(s)`
              }
            />
            <Field label="UTR" value={row.utr ?? '— (gateway skipped)'} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Metric
              label="Total paid"
              value={formatINR(row.totalPaidAmount)}
              tone={Number(row.totalPaidAmount) > 0 ? 'good' : 'default'}
            />
            <Metric
              label="Maturity status"
              value={row.daysToMaturity < 0 ? 'Overdue' : row.daysToMaturity === 0 ? 'Due today' : 'On track'}
              tone={maturityTone}
            />
          </div>
        </Card>

        <Card title="Borrower & bank">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Borrower" value={name} />
            <Field label="Mobile" value={row.mobileNumber} />
            <Field label="Email" value={row.email} />
            <Field label="PAN" value={row.panNumber} />
            <Field label="Address" value={row.address} />
            <Field label="Bank" value={row.bankName} />
            <Field label="Account" value={row.bankAccountMasked ?? row.bankAccountNumber} />
            <Field label="IFSC" value={row.ifscCode} />
            <Field label="Customer" value={
              <Link href={`/customers/${row.customerUuid}`} className="text-brand-blue no-underline hover:underline">
                View customer
              </Link>
            } />
            <Field label="Lead" value={
              <Link href={`/leads/${row.leadUuid}`} className="text-brand-blue no-underline hover:underline">
                View lead
              </Link>
            } />
          </div>
        </Card>
      </div>

      <Card
        title="Repayments"
        action={
          <span className="text-[0.72rem] font-bold text-brand-muted">
            {row.repayments.length} record{row.repayments.length === 1 ? '' : 's'}
          </span>
        }
      >
        {row.repayments.length === 0 ? (
          <p className="m-0 text-[0.88rem] text-brand-muted">No repayments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full border-collapse text-[0.84rem]">
              <thead>
                <tr className="text-left border-b border-[rgba(23,44,113,0.08)]">
                  <th className="px-2 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Date</th>
                  <th className="px-2 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Amount</th>
                  <th className="px-2 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Mode</th>
                  <th className="px-2 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Status</th>
                  <th className="px-2 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">UTR / note</th>
                </tr>
              </thead>
              <tbody>
                {row.repayments.map((payment) => {
                  const failed = payment.status === 'FAILED';
                  return (
                    <tr key={payment.uuid} className="border-b border-[rgba(23,44,113,0.05)] last:border-0">
                      <td className="px-2 py-2.5 whitespace-nowrap">{formatDateTime(payment.paidAt)}</td>
                      <td className="px-2 py-2.5 font-bold">{formatINR(payment.amount)}</td>
                      <td className="px-2 py-2.5">{payment.paymentMode}</td>
                      <td className="px-2 py-2.5">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold"
                          style={
                            failed
                              ? { background: 'rgba(239,68,68,0.14)', color: '#b91c1c' }
                              : { background: 'rgba(16,185,129,0.14)', color: '#047857' }
                          }
                        >
                          {failed ? 'Unsuccessful' : 'Paid fully'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[0.78rem]">
                        {failed
                          ? (payment.failureMessage ?? 'Payment unsuccessful')
                          : (payment.utr ?? '—')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
