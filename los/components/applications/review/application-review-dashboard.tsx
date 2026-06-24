'use client';

import './application-review.css';

import Link from 'next/link';
import {
  ReviewBankPanel,
  ReviewCibilPanel,
  ReviewKycPanel,
  ReviewLoanPanel,
  ReviewPersonalPanel,
  ReviewReferencesPanel,
  ReviewSourcesPanel,
} from '@/components/applications/review/application-review-panels';
import { ApplicationReviewHero } from '@/components/applications/review/application-review-hero';
import { ApplicationReviewToolbar, CopyUuidButton } from '@/components/applications/review/application-review-ui';
import { canRejectApplicationStatus, RejectRecordModal } from '@/components/shared/reject-record-modal';
import { LosStatusPill } from '@/components/shared/los-status-pill';
import { buildReviewFlags } from '@/lib/application-review-flags';
import { isApplicationRecordRejected } from '@/lib/application-workspace-status';
import {
  formatReviewDateTime,
  truncateUuid,
} from '@/lib/application-review-format';
import { buildApplicationJourney, journeyProgressPercent } from '@/lib/customer-journey';
import { extractCibilPan } from '@/lib/kyc-field-match';
import { formatPersonName } from '@/lib/format-person-name';
import { getApplicationCibilReport, type LosApplicationDetails } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ReviewTab = 'personal' | 'cibil' | 'loan' | 'kyc' | 'bank' | 'refs' | 'utm';

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

  const profile = row.lead.profile;
  const displayName = formatPersonName(profile?.fullName, 'Applicant (name pending)');
  const cibilScore = row.bureauReport?.cibilScore ?? row.eligibility?.cibilScore ?? null;
  const loanAmount = row.details?.loanAmount ?? row.preApprovedLoanAmount;
  const journeySteps = buildApplicationJourney(row);
  const progressPct = journeyProgressPercent(journeySteps);
  const isRejected = isApplicationRecordRejected(row);
  const flags = useMemo(() => buildReviewFlags(row, bureauPan), [row, bureauPan]);

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
  ];

  return (
    <div className="app-review ar-full-bleed">
      <div className="ar-wrap">
      <div className="ar-actions">
        <div className="ar-nav">
          <Link href="/applications" className="navbtn">
            ← All applications
          </Link>
          <Link href={`/leads/${row.leadUuid}`} className="navbtn">
            Lead workspace
          </Link>
        </div>
        <ApplicationReviewToolbar
          onRefresh={onRefresh}
          onReject={canRejectApplicationStatus(row.statusCode) ? () => setRejectOpen(true) : undefined}
          rejectDisabled={!canRejectApplicationStatus(row.statusCode)}
        />
      </div>

      <ApplicationReviewHero
        row={row}
        displayName={displayName}
        cibilScore={cibilScore}
        loanAmount={loanAmount}
        journeySteps={journeySteps}
      />

      <RejectRecordModal
        open={rejectOpen}
        token={authToken}
        recordType="application"
        recordUuid={applicationUuid}
        recordLabel={displayName}
        onClose={() => setRejectOpen(false)}
        onSuccess={onRefresh}
      />

      <section className="records">
        <div>
          <div className="rec-label">Record IDs</div>
          <div className="id-grid">
            {[
              { label: 'Application', value: row.uuid, href: null },
              { label: 'Lead', value: row.leadUuid, href: `/leads/${row.leadUuid}` },
              { label: 'Customer', value: row.customerUuid, href: `/customers/${row.customerUuid}` },
            ].map((item) => (
              <div key={item.label} className="idbox">
                <div className="ik">{item.label}</div>
                <div className="iv">
                  {item.href ? (
                    <Link href={item.href} className="uuid uuid-link" title={item.value}>
                      {truncateUuid(item.value)}
                    </Link>
                  ) : (
                    <span className="uuid" title={item.value}>
                      {truncateUuid(item.value)}
                    </span>
                  )}
                  <CopyUuidButton value={item.value} label={item.label} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="rec-label">Timeline</div>
          <div className="meta-grid">
            <div className="meta">
              <div className="mk">Opened</div>
              <div className="mv">{formatReviewDateTime(row.createdAt)}</div>
            </div>
            <div className="meta">
              <div className="mk">Updated</div>
              <div className="mv">{formatReviewDateTime(row.updatedAt)}</div>
            </div>
            <div className="meta">
              <div className="mk">Email verified</div>
              <div className="mv">{formatReviewDateTime(row.emailVerifiedAt)}</div>
            </div>
            <div className="meta">
              <div className="mk">Lead</div>
              <div className={`mv lead-status${row.lead.statusCode.toUpperCase().includes('REJECT') ? ' rejected' : row.lead.statusCode.toUpperCase() === 'CONVERTED' ? ' conv' : ''}`}>
                {row.lead.statusCode.toUpperCase().includes('REJECT') ? (
                  <LosStatusPill code={row.lead.statusCode} label={row.lead.statusLabel} />
                ) : (
                  <>
                    {row.lead.statusCode.toUpperCase() === 'CONVERTED' ? '● ' : ''}
                    {row.lead.statusLabel}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

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
            <ReviewKycPanel row={row} authToken={authToken} />
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
        </div>

        <aside className="rail">
          <section className={`card progress-card${isRejected ? ' is-rejected' : ''}`}>
            <div className="pc-top">
              <div className="pc-h">
                <h3>Application progress</h3>
                <span className={`pc-pct${isRejected ? ' rejected' : ''}`}>{isRejected ? 'Rejected' : `${progressPct}%`}</span>
              </div>
              <div className="pc-sub">
                {isRejected ? 'This application will not move forward in the pipeline' : 'Intake through KYC, bank details, and references'}
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
