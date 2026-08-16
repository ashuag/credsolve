'use client';

import {
  formatApplicationDisplayId,
  formatCityState,
  formatReviewInr,
  isApplicationIdentityVerified,
  personInitials,
} from '@/lib/application-review-format';
import {
  applicationRejectionHeadline,
  buildApplicationWorkspaceAlertText,
  isApplicationRecordRejected,
} from '@/lib/application-workspace-status';
import type { JourneyStep } from '@/lib/customer-journey';
import type { LosApplicationDetails } from '@/lib/api';
import { LosStatusPill } from '@/components/shared/los-status-pill';

export function ApplicationReviewHero({
  row,
  displayName,
  cibilScore,
  cibilCreditAssessmentCategory,
  loanAmount,
  journeySteps,
}: {
  row: LosApplicationDetails;
  displayName: string;
  cibilScore: number | null;
  cibilCreditAssessmentCategory?: string | null;
  loanAmount: string | number | null | undefined;
  journeySteps: JourneyStep[];
}) {
  const profile = row.lead.profile;
  const isRejected = isApplicationRecordRejected(row);
  const activeStep = journeySteps.find((step) => step.state === 'active');
  const stageLabel = isRejected ? applicationRejectionHeadline(row) : (activeStep?.label ?? row.statusLabel);
  const alertText = buildApplicationWorkspaceAlertText(row);
  const identityVerified = isApplicationIdentityVerified({
    kycStatus: row.kycStatus,
    panVerified: row.lead.panVerified ?? 0,
    hasAadhaar: Boolean(row.aadhaarDetail?.maskedAadhaar),
  });

  return (
    <section className={`ar-hero${isRejected ? ' is-rejected' : ''}`}>
      <div className="ar-hero-top">
        <div className="ah-av">{personInitials(profile?.fullName)}</div>
        <div className="ah-main">
          <div className="ah-name-row">
            <div className="ah-name">{displayName}</div>
            {isRejected ? (
              <LosStatusPill code={row.lead.statusCode.toUpperCase().includes('REJECT') ? row.lead.statusCode : row.statusCode} label={applicationRejectionHeadline(row)} />
            ) : null}
          </div>
          <div className="ah-meta">
            <span className="mono">{formatApplicationDisplayId(row.applicationNumber)}</span>
            <span className="ah-sep">•</span>
            <span>{profile?.occupation ?? '—'}</span>
            <span className="ah-sep">•</span>
            <span>{formatCityState(profile?.city, profile?.state)}</span>
            <span className="ah-sep">•</span>
            <span className="mono">{row.mobileNumber}</span>
            {row.email?.trim() ? (
              <>
                <span className="ah-sep">•</span>
                <span>{row.email.trim()}</span>
              </>
            ) : null}
            {identityVerified ? (
              <span className="ah-id-badge">
                <span className="ah-id-dot" aria-hidden />
                Identity verified
              </span>
            ) : null}
          </div>
        </div>
        <div className="ah-metrics">
          <div className="ah-metric">
            <div className="ah-mk">Loan offer</div>
            <div className="ah-mv">{formatReviewInr(loanAmount)}</div>
          </div>
          <div className="ah-metric">
            <div className="ah-mk">CIBIL score</div>
            <div className={`ah-mv${cibilScore != null ? ' cibil' : ''}`}>{cibilScore ?? '—'}</div>
          </div>
          <div className="ah-metric">
            <div className="ah-mk">Grade</div>
            <div className={`ah-mv${cibilCreditAssessmentCategory ? ' cibil' : ''}`}>
              {cibilCreditAssessmentCategory ?? '—'}
            </div>
          </div>
          <div className="ah-metric">
            <div className="ah-mk">{isRejected ? 'Status' : 'Stage'}</div>
            <div className="ah-mv">
              <span className={`ah-stage-pill${isRejected ? ' rejected' : ''}`}>{stageLabel}</span>
            </div>
          </div>
        </div>
      </div>
      {isRejected && alertText ? (
        <div className="ar-rejection-banner" role="status">
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <div>
            <strong>This application cannot proceed.</strong>
            <span>{alertText}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
