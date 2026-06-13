'use client';

import { ApplicationCibilReportTab } from '@/components/applications/application-cibil-report-tab';
import { cx } from '@/components/eligibility/eligibility-ui';
import { fetchApplicationLoanDocumentBlob, type LosApplicationDetails } from '@/lib/api';
import { formatPersonName } from '@/lib/format-person-name';
import { type ReactNode, useState } from 'react';

type OverviewTab = 'profile' | 'cibil' | 'loan' | 'references' | 'kyc' | 'bank';

function DetailGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="m-0 divide-y divide-[rgba(23,44,113,0.06)]">
      {rows.map((row, idx) => (
        <div key={`${row.label}-${idx}`} className="flex items-baseline gap-3 py-1.5 first:pt-0 last:pb-0">
          <dt className="w-[148px] flex-shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-brand-muted leading-tight">
            {row.label}
          </dt>
          <dd className="m-0 min-w-0 flex-1 text-[0.84rem] font-semibold text-brand-text leading-snug">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ageFromDateOfBirth(iso: string | null | undefined) {
  if (!iso) return null;
  const dob = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  if (now < dob) return null;

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years} yrs, ${months} months, ${days} days`;
}

function formatInr(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function dobWithAge(dateOfBirth: string | null | undefined) {
  const formatted = formatDateOnly(dateOfBirth);
  const age = ageFromDateOfBirth(dateOfBirth);
  if (formatted === '—') return '—';
  return age ? `${formatted} (${age})` : formatted;
}

function CustomerProfilePanel({ row }: { row: LosApplicationDetails }) {
  const profile = row.lead.profile;
  const pan = profile?.panNumber?.trim() || row.lead.panNumber?.trim() || '—';
  const address = [profile?.addressLine1, profile?.addressLine2].filter(Boolean).join(', ') || '—';
  const location = [profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ') || '—';

  if (!profile) {
    return <p className="m-0 text-[0.88rem] text-brand-muted">No lead profile is linked to this application yet.</p>;
  }

  return (
    <DetailGrid
      rows={[
        { label: 'Name', value: formatPersonName(profile.fullName) },
        { label: 'Date of birth', value: dobWithAge(profile.dateOfBirth) },
        { label: 'PAN card', value: pan },
        { label: 'Gender', value: profile.gender ?? '—' },
        { label: 'Occupation', value: profile.occupation ?? '—' },
        { label: 'Salary', value: formatInr(profile.netMonthlyIncome) },
        { label: 'Annual profit', value: formatInr(profile.annualProfit) },
        { label: 'Annual turnover', value: formatInr(profile.annualTurnover) },
        { label: 'Address', value: address },
        { label: 'City, state, PIN', value: location },
      ]}
    />
  );
}

function LoanDetailsPanel({
  row,
  applicationUuid,
  authToken,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
}) {
  const [openingDoc, setOpeningDoc] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const details = row.details;
  const sanctionAccepted = Boolean(row.loanDocuments.acceptedAt);

  const handleDownloadSanctionLetter = async () => {
    if (!authToken || !row.loanDocuments.keyFactReady) return;
    setOpeningDoc(true);
    setOpenError(null);
    try {
      const blob = await fetchApplicationLoanDocumentBlob(authToken, applicationUuid, 'key-fact');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'Failed to open sanction letter.');
    } finally {
      setOpeningDoc(false);
    }
  };

  if (!details) {
    return <p className="m-0 text-[0.88rem] text-brand-muted">No loan selection has been saved yet.</p>;
  }

  return (
    <DetailGrid
      rows={[
        { label: 'Pre-approved amount', value: formatInr(row.preApprovedLoanAmount) },
        { label: 'Selected loan amount', value: formatInr(details.loanAmount) },
        {
          label: 'Tenure',
          value: details.loanTenure != null ? `${details.loanTenure} days` : '—',
        },
        { label: 'Repay date', value: formatDateOnly(details.loanMaturityDate) },
        { label: 'ROI %', value: details.interestRate != null ? `${details.interestRate}%` : '—' },
        { label: 'ROI amount', value: formatInr(details.interestAmount) },
        { label: 'Processing fee %', value: details.processingFee != null ? `${details.processingFee}%` : '—' },
        { label: 'Processing fee amount', value: formatInr(details.processingFeeAmount) },
        { label: 'GST %', value: details.gstPercent != null ? `${details.gstPercent}%` : '—' },
        { label: 'GST amount', value: formatInr(details.gstAmount) },
        { label: 'Disbursed amount', value: formatInr(details.disbursedAmount) },
        { label: 'Repay amount', value: formatInr(details.repaymentAmount) },
        { label: 'Sanction letter accepted', value: sanctionAccepted ? 'Yes' : 'No' },
        {
          label: 'Download sanction letter',
          value: row.loanDocuments.keyFactReady ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={openingDoc || !authToken}
                onClick={() => void handleDownloadSanctionLetter()}
                className="inline-flex items-center gap-1 rounded-[6px] border border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.07)] px-2 py-0.5 text-[0.72rem] font-bold text-brand-blue disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[rgba(20,150,243,0.13)]"
              >
                {openingDoc ? 'Opening…' : 'View PDF'}
              </button>
              {row.loanDocuments.keyFactEsigned ? (
                <span className="text-[0.68rem] font-bold text-[#14523a]">E-signed</span>
              ) : null}
              {openError ? <span className="text-[0.68rem] font-semibold text-[#8d3434]">{openError}</span> : null}
            </div>
          ) : (
            'Not generated yet'
          ),
        },
        { label: 'Sanction letter accepted at', value: formatDateTime(row.loanDocuments.acceptedAt) },
      ]}
    />
  );
}

function ReferenceDetailsPanel({ row }: { row: LosApplicationDetails }) {
  if (row.references.length === 0) {
    return <p className="m-0 text-[0.88rem] text-brand-muted">No references saved yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {row.references.map((ref) => (
        <div
          key={`${ref.referenceIndex}-${ref.mobileNumber}`}
          className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)] px-3 py-2.5"
        >
          <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
            Reference {ref.referenceIndex + 1}
          </p>
          <DetailGrid
            rows={[
              { label: 'Name', value: formatPersonName(ref.fullName) },
              { label: 'Mobile', value: ref.mobileNumber },
              { label: 'Relation', value: ref.relation },
            ]}
          />
        </div>
      ))}
    </div>
  );
}

function KycDetailPanel({ row }: { row: LosApplicationDetails }) {
  const aadhaar = row.aadhaarDetail;

  return (
    <DetailGrid
      rows={[
        { label: 'KYC status', value: `${row.kycStatusLabel} (${row.kycStatus})` },
        { label: 'KYC fetched at', value: formatDateTime(row.kycCompletedAt) },
        { label: 'Liveness passed', value: row.livenessPassed ? 'Yes' : 'No' },
        { label: 'Liveness checked at', value: formatDateTime(row.livenessCheckedAt) },
        { label: 'Aadhaar name', value: formatPersonName(aadhaar?.fullName) },
        { label: 'Aadhaar DOB', value: dobWithAge(aadhaar?.dateOfBirth) },
        { label: 'Aadhaar gender', value: aadhaar?.gender ?? '—' },
        { label: 'Aadhaar number', value: aadhaar?.maskedAadhaar ?? '—' },
        { label: 'Aadhaar address', value: aadhaar?.address ?? '—' },
      ]}
    />
  );
}

function BankDetailsPanel({ row }: { row: LosApplicationDetails }) {
  const bank = row.disbursement;

  if (!bank?.accountNumber?.trim() && !bank?.ifscCode?.trim()) {
    return <p className="m-0 text-[0.88rem] text-brand-muted">Bank details have not been submitted yet.</p>;
  }

  return (
    <DetailGrid
      rows={[
        { label: 'Bank name', value: bank.bankName ?? '—' },
        { label: 'Account number', value: bank.accountNumber ?? '—' },
        { label: 'IFSC', value: bank.ifscCode ?? '—' },
        { label: 'Disbursement amount', value: formatInr(bank.amount) },
        { label: 'UTR', value: bank.utr ?? '—' },
        { label: 'Disbursed at', value: formatDateTime(bank.disbursedAt) },
      ]}
    />
  );
}

export function ApplicationOverviewCibilSection({
  row,
  applicationUuid,
  authToken,
  onReportCreated,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
  onReportCreated?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<OverviewTab>('profile');
  const cibilScore = row.bureauReport?.cibilScore ?? row.eligibility?.cibilScore;

  const tabs: Array<{ id: OverviewTab; label: string }> = [
    { id: 'profile', label: 'Customer profile' },
    { id: 'cibil', label: 'CIBIL report' },
    { id: 'loan', label: 'Loan details' },
    { id: 'references', label: 'Reference details' },
    { id: 'kyc', label: 'KYC detail' },
    { id: 'bank', label: 'Bank details' },
  ];

  return (
    <section
      className="overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.09)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))' }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.7)] px-4 py-2.5">
        <span className="inline-flex min-h-[36px] items-center rounded-[10px] bg-brand-navy px-4 text-[0.84rem] font-extrabold text-white shadow-sm">
          Overview
        </span>
        <span className="text-[0.8rem] font-bold text-brand-muted">
          CIBIL report
          {cibilScore != null ? (
            <span className="ml-1.5 inline-flex rounded-full bg-[rgba(20,150,243,0.12)] px-1.5 py-0.5 text-[0.62rem] font-extrabold text-brand-blue">
              {cibilScore}
            </span>
          ) : null}
        </span>
      </div>

      <nav
        className="flex flex-wrap gap-1 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.45)] p-1.5"
        aria-label="Application overview sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'min-h-[36px] rounded-[8px] px-3.5 text-[0.8rem] font-extrabold transition-colors',
              activeTab === tab.id
                ? 'bg-brand-navy text-white shadow-sm'
                : 'text-brand-navy hover:bg-[rgba(23,44,113,0.06)]',
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={activeTab === 'cibil' ? 'p-2' : 'px-4 py-3'}>
        {activeTab === 'profile' ? <CustomerProfilePanel row={row} /> : null}
        {activeTab === 'cibil' ? (
          <ApplicationCibilReportTab applicationUuid={applicationUuid} onReportCreated={onReportCreated} />
        ) : null}
        {activeTab === 'loan' ? (
          <LoanDetailsPanel row={row} applicationUuid={applicationUuid} authToken={authToken} />
        ) : null}
        {activeTab === 'references' ? <ReferenceDetailsPanel row={row} /> : null}
        {activeTab === 'kyc' ? <KycDetailPanel row={row} /> : null}
        {activeTab === 'bank' ? <BankDetailsPanel row={row} /> : null}
      </div>
    </section>
  );
}
