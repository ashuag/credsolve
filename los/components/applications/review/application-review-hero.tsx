'use client';

import {
  formatApplicationDisplayId,
  formatCityState,
  formatReviewInr,
  isApplicationIdentityVerified,
  personInitials,
} from '@/lib/application-review-format';
import type { JourneyStep } from '@/lib/customer-journey';
import type { LosApplicationDetails } from '@/lib/api';

export function ApplicationReviewHero({
  row,
  displayName,
  cibilScore,
  loanAmount,
  journeySteps,
}: {
  row: LosApplicationDetails;
  displayName: string;
  cibilScore: number | null;
  loanAmount: string | number | null | undefined;
  journeySteps: JourneyStep[];
}) {
  const profile = row.lead.profile;
  const activeStep = journeySteps.find((step) => step.state === 'active');
  const stageLabel = activeStep?.label ?? row.statusLabel;
  const identityVerified = isApplicationIdentityVerified({
    kycStatus: row.kycStatus,
    panVerified: row.lead.panVerified ?? 0,
    hasAadhaar: Boolean(row.aadhaarDetail?.maskedAadhaar),
  });

  return (
    <section className="ar-hero">
      <div className="ar-hero-top">
        <div className="ah-av">{personInitials(profile?.fullName)}</div>
        <div className="ah-main">
          <div className="ah-name">{displayName}</div>
          <div className="ah-meta">
            <span className="mono">{formatApplicationDisplayId(row.uuid, row.createdAt)}</span>
            <span className="ah-sep">•</span>
            <span>{profile?.occupation ?? '—'}</span>
            <span className="ah-sep">•</span>
            <span>{formatCityState(profile?.city, profile?.state)}</span>
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
            <div className="ah-mk">Stage</div>
            <div className="ah-mv">
              <span className="ah-stage-pill">{stageLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
