'use client';

import './application-review.css';

import {
  ReviewBankPanel,
  ReviewCibilPanel,
  ReviewKycPanel,
  ReviewLoanPanel,
  ReviewPersonalPanel,
  ReviewRecordIdsPanel,
  ReviewReferencesPanel,
  ReviewSourcesPanel,
  ReviewTimelinePanel,
} from '@/components/applications/review/application-review-panels';
import { ApplicationReviewHero } from '@/components/applications/review/application-review-hero';
import { ApplicationReviewToolbar } from '@/components/applications/review/application-review-ui';
import { canRejectApplicationStatus, RejectRecordModal } from '@/components/shared/reject-record-modal';
import { buildReviewFlags } from '@/lib/application-review-flags';
import { isApplicationRecordRejected } from '@/lib/application-workspace-status';
import { buildApplicationJourney, journeyProgressPercent } from '@/lib/customer-journey';
import { extractCibilPan } from '@/lib/kyc-field-match';
import { formatPersonName } from '@/lib/format-person-name';
import {
  approveApplication,
  disburseApplication,
  getApplicationCibilReport,
  type LosApplicationDetails,
} from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ReviewTab = 'personal' | 'cibil' | 'loan' | 'kyc' | 'bank' | 'refs' | 'utm' | 'ids' | 'timeline';

export function ApplicationReviewDashboard({
  row,
  applicationUuid,
  authToken,
  onRefresh,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ReviewTab>(row.details?.loanAmount ? 'loan' : 'personal');
  const [bureauPan, setBureauPan] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);
  const [disburseBusy, setDisburseBusy] = useState(false);

  const profile = row.lead.profile;
  const displayName = formatPersonName(profile?.fullName, 'Applicant (name pending)');
  const cibilScore = row.bureauReport?.cibilScore ?? null;
  const loanAmount = row.details?.loanAmount ?? row.preApprovedLoanAmount;
  const journeySteps = buildApplicationJourney(row);
  const progressPct = journeyProgressPercent(journeySteps);
  const isRejected = isApplicationRecordRejected(row);
  const flags = useMemo(() => buildReviewFlags(row, bureauPan), [row, bureauPan]);
  const statusCode = row.statusCode.toUpperCase();
  const journeyComplete =
    !isRejected &&
    journeySteps.length > 0 &&
    journeySteps.every((step) => step.state === 'done');
  const canApprove = journeyComplete && statusCode !== 'APPROVED' && statusCode !== 'DISBURSED';
  const canDisburse = statusCode === 'APPROVED' && !row.loanAccount;

  const loadBureauPan = useCallback(async () => {
    if (!authToken || !row.bureauReport) {
      setBureauPan(null);
      return;
    }
    try {
      const payload = await getApplicationCibilReport(authToken, applicationUuid);
      setBureauPan(extractCibilPan(payload.report.identifiers));
    } catch {
      setBureauPan(null);
    }
  }, [applicationUuid, authToken, row.bureauReport]);

  useEffect(() => {
    void loadBureauPan();
  }, [loadBureauPan]);

  const handleApprove = useCallback(async () => {
    if (!authToken || approveBusy) return;
    const confirmed = window.confirm(
      `Approve application ${row.applicationNumber}? Status will change to APPROVED.`,
    );
    if (!confirmed) return;
    setApproveBusy(true);
    setActionError(null);
    try {
      await approveApplication(authToken, applicationUuid);
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to approve application.');
    } finally {
      setApproveBusy(false);
    }
  }, [applicationUuid, approveBusy, authToken, onRefresh, row.applicationNumber]);

  const handleDisburse = useCallback(async () => {
    if (!authToken || disburseBusy) return;
    const confirmed = window.confirm(
      `Disburse loan for ${row.applicationNumber}?\n\nThis will create the loan account (loan number = application number), set status to DISBURSED, and email the final sanction letter. Payment gateway is skipped for now.`,
    );
    if (!confirmed) return;
    setDisburseBusy(true);
    setActionError(null);
    try {
      await disburseApplication(authToken, applicationUuid);
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to disburse loan.');
    } finally {
      setDisburseBusy(false);
    }
  }, [applicationUuid, authToken, disburseBusy, onRefresh, row.applicationNumber]);

  const tabs: Array<{ id: ReviewTab; label: string; badge?: React.ReactNode }> = [
    { id: 'personal', label: 'Personal details' },
    { id: 'cibil', label: 'CIBIL report' },
    { id: 'loan', label: 'Loan details' },
    {
      id: 'kyc',
      label: 'KYC detail',
      badge: row.kycStatus === 1 ? <span className="cnt ok">✓</span> : null,
    },
    {
      id: 'bank',
      label: 'Bank details',
      badge:
        row.disbursement?.accountNumber?.trim() ? <span className="cnt ok">✓</span> : null,
    },
    {
      id: 'refs',
      label: 'Reference details',
      badge: row.referencesCount > 0 ? <span className="cnt">{row.referencesCount}</span> : null,
    },
    { id: 'utm', label: 'Sources & UTMs' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'ids', label: 'Record IDs' },
  ];

  return (
    <div className="app-review ar-full-bleed">
      <div className="ar-wrap">
      <ApplicationReviewHero
        row={row}
        displayName={displayName}
        cibilScore={cibilScore}
        loanAmount={loanAmount}
        journeySteps={journeySteps}
      />

      <div className="ar-toolbar">
        <ApplicationReviewToolbar
          onRefresh={onRefresh}
          onReject={canRejectApplicationStatus(row.statusCode) ? () => setRejectOpen(true) : undefined}
          rejectDisabled={!canRejectApplicationStatus(row.statusCode)}
          onApprove={canApprove ? () => void handleApprove() : undefined}
          approveBusy={approveBusy}
          onDisburse={canDisburse ? () => void handleDisburse() : undefined}
          disburseBusy={disburseBusy}
        />
      </div>

      {actionError ? (
        <div className="mb-4 rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[#fef2f2] px-4 py-3 text-[0.85rem] font-semibold text-[#b91c1c]" role="alert">
          {actionError}
        </div>
      ) : null}

      <RejectRecordModal
        open={rejectOpen}
        token={authToken}
        recordType="application"
        recordUuid={applicationUuid}
        recordLabel={displayName}
        onClose={() => setRejectOpen(false)}
        onSuccess={onRefresh}
      />

      <nav className="tabs" aria-label="Application review sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' on' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
            {tab.badge}
          </button>
        ))}
      </nav>

      <div className="ar-layout-grid">
        <div className="col-main">
          <div className={`panel${activeTab === 'personal' ? ' on' : ''}`}>
            <ReviewPersonalPanel row={row} applicationUuid={applicationUuid} authToken={authToken} />
          </div>
          <div className={`panel${activeTab === 'cibil' ? ' on' : ''}`}>
            <ReviewCibilPanel row={row} applicationUuid={applicationUuid} onReportCreated={onRefresh} />
          </div>
          <div className={`panel${activeTab === 'loan' ? ' on' : ''}`}>
            <ReviewLoanPanel row={row} applicationUuid={applicationUuid} authToken={authToken} onDataChange={onRefresh} />
          </div>
          <div className={`panel${activeTab === 'kyc' ? ' on' : ''}`}>
            <ReviewKycPanel row={row} applicationUuid={applicationUuid} authToken={authToken} onRefresh={onRefresh} />
          </div>
          <div className={`panel${activeTab === 'bank' ? ' on' : ''}`}>
            <ReviewBankPanel row={row} />
          </div>
          <div className={`panel${activeTab === 'refs' ? ' on' : ''}`}>
            <ReviewReferencesPanel row={row} />
          </div>
          <div className={`panel${activeTab === 'utm' ? ' on' : ''}`}>
            <ReviewSourcesPanel row={row} />
          </div>
          <div className={`panel${activeTab === 'timeline' ? ' on' : ''}`}>
            <ReviewTimelinePanel row={row} />
          </div>
          <div className={`panel${activeTab === 'ids' ? ' on' : ''}`}>
            <ReviewRecordIdsPanel row={row} />
          </div>
        </div>

        <aside className="rail">
          <section className={`card progress-card${isRejected ? ' is-rejected' : ''}`}>
            <div className="pc-top">
              <div className="pc-h">
                <h3>Application progress</h3>
                <span className={`pc-pct${isRejected ? ' rejected' : ''}`}>{isRejected ? 'Rejected' : `${progressPct}%`}</span>
              </div>
              <div className="pc-sub">
                {isRejected
                  ? 'This application will not move forward in the pipeline'
                  : 'Letter review through KYC, bank, references, and sanction OTP'}
              </div>
              <div className="pbar">
                <i style={{ width: isRejected ? '100%' : `${progressPct}%` }} className={isRejected ? 'rejected' : undefined} />
              </div>
            </div>
            <div className="steps">
              {journeySteps.map((step) => {
                const stepClass =
                  step.state === 'done'
                    ? 'done'
                    : step.state === 'failed'
                      ? 'fail'
                      : step.state === 'active'
                        ? 'cur'
                        : 'todo';
                return (
                  <div key={step.id} className={`step ${stepClass}`}>
                    <div className="node">
                      {step.state === 'done' ? '✓' : step.state === 'failed' ? '✕' : ''}
                    </div>
                    <div>
                      <div className="stt">{step.label}</div>
                      {step.detail ? (
                        <div className="ssub">
                          <span
                            className={`chip${
                              step.state === 'failed'
                                ? ' bad'
                                : step.state === 'done'
                                  ? step.detail.toLowerCase().includes('cibil') || step.detail.startsWith('₹')
                                    ? ' info mono'
                                    : ' ok'
                                  : ''
                            }`}
                          >
                            {step.detail}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {flags.length > 0 ? (
            <section className={`card${isRejected ? ' flags-rejected' : ''}`}>
              <div className="card-h">
                <span className="ico" style={{ background: isRejected ? 'var(--bad-bg)' : 'var(--warn-bg)', color: isRejected ? 'var(--bad)' : 'var(--warn)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M12 9v4M12 17h.01" />
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                </span>
                <h3 style={{ color: isRejected ? 'var(--bad)' : 'var(--warn)' }}>
                  Review flags <span style={{ color: 'var(--ink-3)', fontWeight: 600, fontSize: 12 }}>({flags.length})</span>
                </h3>
              </div>
              <div className="card-b">
                {flags.map((flag) => (
                  <div key={flag.title} className="flag-row">
                    <div className="fi">{flag.icon}</div>
                    <div>
                      <div className="ftt">{flag.title}</div>
                      <div className="fds">{flag.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
      </div>
    </div>
  );
}
