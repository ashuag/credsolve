'use client';

import { ApplicationCibilReportTab } from '@/components/applications/application-cibil-report-tab';
import {
  MaskedSecret,
  ReviewCard,
  ReviewEmptyState,
  ReviewField,
  ReviewMatchBadge,
  ReviewPill,
  ReviewSectionLabel,
} from '@/components/applications/review/application-review-ui';
import {
  formatReviewDateOnly,
  formatReviewDateTime,
  formatReviewInr,
  formatReviewInrSigned,
  maskAccount,
  maskPan,
  parseInrNumber,
  cibilScoreBand,
} from '@/lib/application-review-format';
import { usesAnnualFinancialMetric, usesMonthlyIncomeMetric, resolveOccupationKey } from '@/lib/customer-details';
import {
  compareGenders,
  compareIsoDates,
  comparePan,
  computeNameMatchScore,
  dedupeCibilPhones,
  extractCibilPan,
  formatAadhaarNumberDisplay,
  formatDobWithAge,
  nameMatchVerdict,
  normalizeAadhaarGender,
  type KycMatchVerdict,
} from '@/lib/kyc-field-match';
import {
  fetchApplicationLoanDocumentBlob,
  generateApplicationLoanDocuments,
  getApplicationCibilReport,
  type CibilReportData,
  type LosApplicationDetails,
} from '@/lib/api';
import {
  formatConfidencePercent,
  formatLaplacianVariance,
  formatLivenessSummary,
  formatSelfieFaceValidationSummary,
} from '@/lib/kyc-selfie-validation-display';
import { KycPhotoGallery } from '@/components/shared/kyc-photo-gallery';
import { formatPersonName } from '@/lib/format-person-name';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

const MIN_MONTHLY_INCOME_SALARIED = 10_000;

function useCibilReport(
  row: LosApplicationDetails,
  applicationUuid: string,
  authToken: string | null,
) {
  const [cibilReport, setCibilReport] = useState<CibilReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authToken || !row.bureauReport) {
      setCibilReport(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await getApplicationCibilReport(authToken, applicationUuid);
      setCibilReport(payload.report);
    } catch (e) {
      setCibilReport(null);
      setError(e instanceof Error ? e.message : 'Failed to load CIBIL details.');
    } finally {
      setLoading(false);
    }
  }, [applicationUuid, authToken, row.bureauReport]);

  useEffect(() => {
    void load();
  }, [load]);

  return { cibilReport, loading, error, reload: load };
}

export function ReviewLoanPanel({
  row,
  applicationUuid,
  authToken,
  onDataChange,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
  onDataChange?: () => void;
}) {
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [docsActionResult, setDocsActionResult] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const details = row.details;

  if (!details) {
    return (
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
        title="Loan economics"
      >
        <ReviewEmptyState title="No loan selection" subtitle="The customer has not saved a loan offer yet." />
      </ReviewCard>
    );
  }

  const loanAmount = parseInrNumber(details.loanAmount) ?? 0;
  const processingFee = parseInrNumber(details.processingFeeAmount) ?? 0;
  const gst = parseInrNumber(details.gstAmount) ?? 0;
  const interest = parseInrNumber(details.interestAmount) ?? 0;
  const disbursed = parseInrNumber(details.disbursedAmount) ?? loanAmount - processingFee - gst;
  const repayable = parseInrNumber(details.repaymentAmount) ?? loanAmount + interest + processingFee + gst;
  const costOfCredit = repayable - disbursed;
  const tenureLabel =
    details.loanTenure != null
      ? `${details.loanTenure}-day term${details.loanMaturityDate ? ` · due ${formatReviewDateOnly(details.loanMaturityDate)}` : ''}`
      : details.loanMaturityDate
        ? `Due ${formatReviewDateOnly(details.loanMaturityDate)}`
        : 'Term pending';

  return (
    <>
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
        title="Loan economics"
        right={<ReviewPill>{tenureLabel}</ReviewPill>}
      >
        <div className="money">
          <div className="money-col">
            <h4>Disbursement</h4>
            <div className="mrow pos">
              <span className="mlab">Selected loan amount</span>
              <span className="mamt">{formatReviewInr(loanAmount)}</span>
            </div>
            {processingFee > 0 ? (
              <div className="mrow neg">
                <span className="mlab">
                  Processing fee {details.processingFee != null ? <small>{details.processingFee}%</small> : null}
                </span>
                <span className="mamt">{formatReviewInrSigned(processingFee, true)}</span>
              </div>
            ) : null}
            {gst > 0 ? (
              <div className="mrow neg">
                <span className="mlab">
                  GST on fee {details.gstPercent != null ? <small>{details.gstPercent}%</small> : null}
                </span>
                <span className="mamt">{formatReviewInrSigned(gst, true)}</span>
              </div>
            ) : null}
            <div className="mrow total green">
              <span className="mlab">Disbursed to bank</span>
              <span className="mamt">{formatReviewInr(disbursed)}</span>
            </div>
          </div>
          <div className="money-arrow">
            <span className="ar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="money-col">
            <h4>Repayment</h4>
            <div className="mrow pos">
              <span className="mlab">Principal</span>
              <span className="mamt">{formatReviewInr(loanAmount)}</span>
            </div>
            {interest > 0 ? (
              <div className="mrow pos">
                <span className="mlab">
                  Interest {details.interestRate != null ? <small>ROI {details.interestRate}%</small> : null}
                </span>
                <span className="mamt">{formatReviewInr(interest)}</span>
              </div>
            ) : null}
            {processingFee + gst > 0 ? (
              <div className="mrow pos">
                <span className="mlab">Processing fee + GST</span>
                <span className="mamt">{formatReviewInr(processingFee + gst)}</span>
              </div>
            ) : null}
            <div className="mrow total amt">
              <span className="mlab">Total repayable</span>
              <span className="mamt">{formatReviewInr(repayable)}</span>
            </div>
          </div>
        </div>
        {costOfCredit > 0 ? (
          <div className="cost-banner">
            <span className="cb-ic">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <div>
              <div className="cb-t">Total cost of credit</div>
              <div className="cb-s">
                Borrower receives {formatReviewInr(disbursed)}, repays {formatReviewInr(repayable)}. Confirm APR is disclosed on the KFS per RBI guidelines.
              </div>
            </div>
            <div className="cb-amt">
              <div className="k">Cost</div>
              <div className="v">{formatReviewInr(costOfCredit)}</div>
            </div>
          </div>
        ) : null}
      </ReviewCard>

      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
          </svg>
        }
        title="Amounts, interest & fees"
      >
        <ReviewSectionLabel first>Amounts</ReviewSectionLabel>
        <div className="fgrid thirds">
          <ReviewField label="Pre-approved" value={<span className="mono">{formatReviewInr(row.preApprovedLoanAmount)}</span>} />
          <ReviewField label="Selected" value={<span className="mono">{formatReviewInr(details.loanAmount)}</span>} />
          <ReviewField label="Tenure" value={details.loanTenure != null ? `${details.loanTenure} days` : '—'} />
          <ReviewField label="Disbursed" value={<span className="mono">{formatReviewInr(details.disbursedAmount)}</span>} tone="accent" />
          <ReviewField label="Repay date" value={formatReviewDateOnly(details.loanMaturityDate)} />
          <ReviewField label="Repay amount" value={<span className="mono">{formatReviewInr(details.repaymentAmount)}</span>} />
        </div>
        <ReviewSectionLabel>Interest &amp; fees</ReviewSectionLabel>
        <div className="fgrid thirds">
          <ReviewField
            label="ROI"
            value={
              details.interestRate != null
                ? `${details.interestRate}% · ${formatReviewInr(details.interestAmount)}`
                : '—'
            }
          />
          <ReviewField
            label="Processing fee"
            value={
              details.processingFee != null
                ? `${details.processingFee}% · ${formatReviewInr(details.processingFeeAmount)}`
                : '—'
            }
          />
          <ReviewField
            label="GST"
            value={
              details.gstPercent != null
                ? `${details.gstPercent}% · ${formatReviewInr(details.gstAmount)}`
                : '—'
            }
          />
        </div>
      </ReviewCard>

      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        }
        title="Loan documents"
        right={
          <button
            type="button"
            className="btn-sm"
            disabled={generatingDocs || !authToken}
            onClick={async () => {
              if (!authToken) return;
              setGeneratingDocs(true);
              setDocsActionResult(null);
              try {
                const result = await generateApplicationLoanDocuments(authToken, applicationUuid);
                setDocsActionResult(`Generated: ${result.generated.join(', ')}`);
                onDataChange?.();
              } catch (e) {
                setDocsActionResult(e instanceof Error ? e.message : 'Failed to generate documents.');
              } finally {
                setGeneratingDocs(false);
              }
            }}
          >
            {generatingDocs ? 'Generating…' : '＋ Generate PDFs'}
          </button>
        }
      >
        <div className="doc">
          <div className="doc-top">
            <span className="doc-ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M9 13h6M9 17h4" />
              </svg>
            </span>
            <div>
              <div className="doc-name">Sanction letter cum KFS</div>
              <div className="doc-sub">Key Fact Statement · PKCS#7 e-signed when available</div>
            </div>
            <div className="doc-actions">
              {row.loanDocuments.keyFactEsigned ? <span className="badge signed">✓ E-signed</span> : null}
              {row.loanDocuments.keyFactReady ? (
                <span className="badge ready">Ready</span>
              ) : (
                <span className="badge" style={{ background: 'var(--mute-bg)', color: 'var(--ink-3)', borderColor: 'var(--line)' }}>
                  Not generated
                </span>
              )}
              <button
                type="button"
                className="btn-sm link"
                disabled={!row.loanDocuments.keyFactReady || opening || !authToken}
                onClick={async () => {
                  if (!authToken) return;
                  setOpening(true);
                  try {
                    const blob = await fetchApplicationLoanDocumentBlob(authToken, applicationUuid, 'key-fact');
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank', 'noopener');
                    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
                  } finally {
                    setOpening(false);
                  }
                }}
              >
                {opening ? 'Opening…' : 'View PDF'}
              </button>
            </div>
          </div>
          {row.loanDocuments.acceptedAt ? (
            <div className="accept-note">
              <span className="an-ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span>
                Accepted by customer · <b>{formatReviewDateTime(row.loanDocuments.acceptedAt)}</b>
              </span>
            </div>
          ) : null}
        </div>
        {docsActionResult ? (
          <p style={{ margin: '12px 0 0', fontSize: '12px', color: docsActionResult.startsWith('Generated') ? 'var(--ok)' : 'var(--bad)' }}>
            {docsActionResult}
          </p>
        ) : null}
      </ReviewCard>
    </>
  );
}

export function ReviewKycPanel({
  row,
  authToken,
}: {
  row: LosApplicationDetails;
  authToken: string | null;
}) {
  const kycDone = row.kycStatus === 1;
  return (
    <>
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        }
        title="KYC & liveness"
        iconTone={kycDone ? 'ok' : 'default'}
        right={kycDone ? <ReviewPill tone="ok">Completed</ReviewPill> : <ReviewPill tone="warn">Pending</ReviewPill>}
      >
        <div style={{ marginBottom: 16 }}>
          <ReviewSectionLabel>KYC photos</ReviewSectionLabel>
          <div style={{ marginTop: 8 }}>
            <KycPhotoGallery row={row} authToken={authToken} />
          </div>
        </div>
        <div className="fgrid">
          <ReviewField label="KYC status" value={`${row.kycStatusLabel} (${row.kycStatus})`} tone={kycDone ? 'accent' : undefined} />
          <ReviewField
            label="Face validation (on-server ML)"
            value={formatSelfieFaceValidationSummary(row)}
            tone={row.selfieFaceValidation?.passed ? 'accent' : row.selfieFaceValidation?.checkedAt ? 'flag' : undefined}
            sub={
              row.selfieFaceValidation?.reason && !row.selfieFaceValidation.passed
                ? row.selfieFaceValidation.reason
                : row.selfieFaceValidation?.confidenceBreakdown
                  ? `Detection ${formatConfidencePercent(row.selfieFaceValidation.confidenceBreakdown.detection)} · alignment ${formatConfidencePercent(row.selfieFaceValidation.confidenceBreakdown.landmarkAlignment)}${
                      row.selfieFaceValidation.laplacianVariance != null
                        ? ` · Laplacian ${formatLaplacianVariance(row.selfieFaceValidation.laplacianVariance)} (min ${formatLaplacianVariance(row.selfieFaceValidation.minLaplacianVarianceRequired)})`
                        : ''
                    }`
                  : undefined
            }
          />
          <ReviewField
            label="Liveness (Tenacio)"
            value={formatLivenessSummary(row)}
            tone={row.livenessPassed ? 'accent' : row.livenessSummary?.checkedAt ? 'flag' : undefined}
            sub={
              row.livenessSummary?.vendorStatus
                ? `Vendor status: ${row.livenessSummary.vendorStatus}`
                : undefined
            }
          />
          <ReviewField label="Liveness passed" value={row.livenessPassed ? 'Yes' : 'No'} tone={row.livenessPassed ? 'accent' : undefined} />
          <ReviewField label="KYC fetched at" value={formatReviewDateTime(row.kycCompletedAt)} />
          <ReviewField label="Face validation at" value={formatReviewDateTime(row.selfieFaceValidation?.checkedAt ?? null)} />
          <ReviewField label="Liveness checked at" value={formatReviewDateTime(row.livenessCheckedAt)} />
        </div>
        {row.livenessPassed ? (
          <p style={{ margin: '13px 0 0', fontSize: '11.5px', color: 'var(--ink-3)' }}>
            Aadhaar photo and live selfie liveness check passed — see the applicant header.
          </p>
        ) : null}
      </ReviewCard>

      {row.agreement ? (
        <ReviewCard
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          }
          title="Agreement · e-sign & legal"
          right={<span className="badge signed">✓ E-signed</span>}
        >
          <div className="deflist">
            <div className="defrow">
              <span className="dk">Document</span>
              <span className="dv">{row.agreement.documentName ?? '—'}</span>
            </div>
            <div className="defrow">
              <span className="dk">Signed at</span>
              <span className="dv">{formatReviewDateTime(row.agreement.signedAt)}</span>
            </div>
            <div className="defrow">
              <span className="dk">IP address</span>
              <span className="dv mono">{row.agreement.ipAddress ?? '—'}</span>
            </div>
          </div>
        </ReviewCard>
      ) : null}
    </>
  );
}

export function ReviewBankPanel({ row }: { row: LosApplicationDetails }) {
  const bank = row.disbursement;
  if (!bank?.accountNumber?.trim() && !bank?.ifscCode?.trim()) {
    return (
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 21h18M5 21V10M19 21V10M3 10l9-6 9 6M9 21v-6h6v6" />
          </svg>
        }
        title="Disbursement account"
      >
        <ReviewEmptyState title="Bank details pending" subtitle="The customer has not submitted disbursement account details yet." />
      </ReviewCard>
    );
  }

  const pending = !bank.disbursedAt && !bank.utr?.trim();

  return (
    <ReviewCard
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 21h18M5 21V10M19 21V10M3 10l9-6 9 6M9 21v-6h6v6" />
        </svg>
      }
      title="Disbursement account"
      right={pending ? <ReviewPill tone="warn">Awaiting disbursement</ReviewPill> : <ReviewPill tone="ok">Disbursed</ReviewPill>}
    >
      <div className="fgrid">
        <ReviewField label="Bank name" value={bank.bankName ?? '—'} />
        <ReviewField label="IFSC" value={<span className="mono">{bank.ifscCode ?? '—'}</span>} />
        <ReviewField
          label="Account number"
          value={
            bank.accountNumber ? (
              <MaskedSecret value={bank.accountNumber} mask={maskAccount(bank.accountNumber)} />
            ) : (
              '—'
            )
          }
        />
        <ReviewField label="Disbursement amount" value={<span className="mono">{formatReviewInr(bank.amount ?? row.details?.disbursedAmount)}</span>} tone="accent" />
        <ReviewField
          label="UTR"
          value={bank.utr ?? 'Not yet generated'}
          tone={!bank.utr?.trim() ? 'flag' : undefined}
          sub={!bank.utr?.trim() ? 'Populated after payout is initiated' : undefined}
        />
        <ReviewField
          label="Disbursed at"
          value={bank.disbursedAt ? formatReviewDateTime(bank.disbursedAt) : 'Pending'}
          tone={!bank.disbursedAt ? 'flag' : undefined}
        />
      </div>
    </ReviewCard>
  );
}

function ComparedField({
  label,
  value,
  verdict,
  score,
}: {
  label: string;
  value: ReactNode;
  verdict: KycMatchVerdict;
  score?: number;
}) {
  return (
    <ReviewField
      label={label}
      value={value}
      badge={<ReviewMatchBadge verdict={verdict} score={score} />}
      badgeInValue
    />
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M5.5 21a8 8 0 0 1 13 0" />
    </svg>
  );
}

function IdCardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <path d="M15 10h3M15 14h3" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function formatCityStatePincode(
  city: string | null | undefined,
  state: string | null | undefined,
  pincode: string | null | undefined,
): string {
  const parts = [city?.trim(), state?.trim(), pincode?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function CompactAddressBlock({
  addressLine1,
  addressLine2,
  city,
  state,
  pincode,
}: {
  addressLine1: string | null | undefined;
  addressLine2: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
  pincode: string | null | undefined;
}) {
  const line1 = addressLine1?.trim() || '';
  const line2 = addressLine2?.trim() || '';
  const location = formatCityStatePincode(city, state, pincode);

  return (
    <div className="address-compact">
      <div className="address-line">
        <span className="address-lab">Address line 1</span>
        <span className={`address-val${line1 ? '' : ' empty'}`}>{line1 || '—'}</span>
      </div>
      <div className="address-line">
        <span className="address-lab">Address line 2</span>
        <span className={`address-val${line2 ? '' : ' empty'}`}>{line2 || '—'}</span>
      </div>
      <div className="address-line">
        <span className="address-lab">City, state, pincode</span>
        <span className={`address-val${location === '—' ? ' empty' : ''}`}>{location}</span>
      </div>
    </div>
  );
}

function GovernmentIdsBlock({
  loading,
  error,
  otherIds,
  hasBureauReport,
  pan,
}: {
  loading: boolean;
  error: string | null;
  otherIds: Array<{ type: string; number: string }>;
  hasBureauReport: boolean;
  pan: string;
}) {
  if (loading) return <p style={{ margin: 0, color: 'var(--ink-3)' }}>Loading…</p>;
  if (error) return <p style={{ margin: 0, color: 'var(--bad)' }}>{error}</p>;
  if (otherIds.length > 0) {
    return (
      <div className="fgrid">
        {otherIds.map((identifier) => (
          <ReviewField
            key={`${identifier.type}-${identifier.number}`}
            label={identifier.type}
            value={<span className="mono">{identifier.number}</span>}
          />
        ))}
      </div>
    );
  }
  if (hasBureauReport) {
    return (
      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-3)' }}>
        {pan ? 'No additional government IDs on the CIBIL report (PAN shown above).' : 'No government IDs on the CIBIL report.'}
      </p>
    );
  }
  return <ReviewEmptyState title="No bureau pull" subtitle="Government IDs appear after the CIBIL report is fetched." />;
}

function IdentityMatrix({
  rows,
}: {
  rows: Array<{
    field: string;
    application: ReactNode;
    aadhaar: ReactNode;
    cibil: ReactNode;
    verdict: KycMatchVerdict;
    score?: number;
  }>;
}) {
  return (
    <div className="identity-matrix-wrap">
      <table className="identity-matrix">
        <thead>
          <tr>
            <th>Field</th>
            <th>Application</th>
            <th>Aadhaar</th>
            <th>CIBIL</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="im-field">{row.field}</td>
              <td>{row.application}</td>
              <td>{row.aadhaar}</td>
              <td>{row.cibil}</td>
              <td>
                <ReviewMatchBadge verdict={row.verdict} score={row.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReviewPersonalPanel({
  row,
  applicationUuid,
  authToken,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
}) {
  const profile = row.lead.profile;
  const aadhaar = row.aadhaarDetail;
  const { cibilReport, loading, error } = useCibilReport(row, applicationUuid, authToken);

  if (!profile) {
    return (
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M5.5 21a8 8 0 0 1 13 0" />
          </svg>
        }
        title="Personal & identity"
      >
        <ReviewEmptyState title="Profile pending" subtitle="No lead profile is linked to this application yet." />
      </ReviewCard>
    );
  }

  const pan = profile.panNumber?.trim() || row.lead.panNumber?.trim() || '';
  const bureauPan = cibilReport ? extractCibilPan(cibilReport.identifiers) : null;
  const occupationKey = resolveOccupationKey(profile.occupationKey, profile.occupation);
  const monthlyIncome = parseInrNumber(profile.netMonthlyIncome);
  const salaryFlag =
    occupationKey === 'SALARIED' && monthlyIncome != null && monthlyIncome < MIN_MONTHLY_INCOME_SALARIED;

  const nameScore = computeNameMatchScore(profile.fullName, aadhaar?.fullName);
  const nameVerdict = nameMatchVerdict(nameScore, Boolean(profile.fullName && aadhaar?.fullName));
  const dobVerdict = compareIsoDates(profile.dateOfBirth, aadhaar?.dateOfBirth);
  const genderVerdict = compareGenders(profile.gender, aadhaar?.gender);
  const panVerdict = comparePan(pan, bureauPan);
  const cibilNameScore = computeNameMatchScore(profile.fullName, cibilReport?.consumerName);
  const cibilNameVerdict = nameMatchVerdict(
    cibilNameScore,
    Boolean(profile.fullName && cibilReport?.consumerName?.trim()),
  );
  const cibilDobVerdict = compareIsoDates(profile.dateOfBirth, cibilReport?.dateOfBirth);

  const hasAadhaar = Boolean(
    aadhaar?.fullName?.trim() ||
      aadhaar?.dateOfBirth ||
      aadhaar?.gender?.trim() ||
      aadhaar?.maskedAadhaar?.trim() ||
      aadhaar?.address?.trim(),
  );

  const allMatch =
    hasAadhaar &&
    nameVerdict !== 'mismatch' &&
    dobVerdict !== 'mismatch' &&
    genderVerdict !== 'mismatch' &&
    panVerdict !== 'mismatch' &&
    (!cibilReport || (cibilNameVerdict !== 'mismatch' && cibilDobVerdict !== 'mismatch'));

  const otherIds =
    cibilReport?.identifiers.filter((identifier) => {
      const idPan = extractCibilPan([identifier]);
      if (!idPan || !pan) return true;
      return idPan !== pan.toUpperCase();
    }) ?? [];

  const matrixRows = [
    {
      field: 'Name',
      application: formatPersonName(profile.fullName),
      aadhaar: hasAadhaar ? formatPersonName(aadhaar?.fullName) : <span className="im-muted">—</span>,
      cibil: cibilReport ? formatPersonName(cibilReport.consumerName) : <span className="im-muted">—</span>,
      verdict: nameVerdict,
      score: nameScore,
    },
    {
      field: 'Date of birth',
      application: formatDobWithAge(profile.dateOfBirth),
      aadhaar: hasAadhaar ? formatDobWithAge(aadhaar?.dateOfBirth) : <span className="im-muted">—</span>,
      cibil: cibilReport ? formatDobWithAge(cibilReport.dateOfBirth) : <span className="im-muted">—</span>,
      verdict: dobVerdict,
    },
    {
      field: 'Gender',
      application: profile.gender ?? '—',
      aadhaar: hasAadhaar ? (normalizeAadhaarGender(aadhaar?.gender) ?? '—') : <span className="im-muted">—</span>,
      cibil: cibilReport?.gender ? cibilReport.gender : <span className="im-muted">—</span>,
      verdict: genderVerdict,
    },
    {
      field: 'PAN',
      application: pan ? <MaskedSecret value={pan} mask={maskPan(pan)} /> : '—',
      aadhaar: <span className="im-muted">Not on Aadhaar</span>,
      cibil: bureauPan ? <span className="mono">{maskPan(bureauPan)}</span> : <span className="im-muted">—</span>,
      verdict: panVerdict,
    },
  ];

  return (
    <div className="ar-personal-stack">
      <div className="ar-personal-top">
        <ReviewCard
          icon={<PersonIcon />}
          title="Personal & identity"
          right={
            allMatch ? (
              <ReviewPill tone="ok">All sources match</ReviewPill>
            ) : (
              <ReviewPill tone="warn">Review matches</ReviewPill>
            )
          }
        >
          <div className="fgrid">
            <ComparedField label="Full name" value={formatPersonName(profile.fullName)} verdict={nameVerdict} score={nameScore} />
            <ComparedField label="Date of birth" value={formatDobWithAge(profile.dateOfBirth)} verdict={dobVerdict} />
            <ComparedField label="Gender" value={profile.gender ?? '—'} verdict={genderVerdict} />
            <ReviewField
              label="PAN"
              value={pan ? <MaskedSecret value={pan} mask={maskPan(pan)} /> : '—'}
              badge={<ReviewMatchBadge verdict={panVerdict} />}
              badgeInValue
            />
            <ReviewField label="Occupation" value={profile.occupation ?? '—'} />
            {usesMonthlyIncomeMetric(occupationKey) ? (
              <ReviewField
                label="Monthly salary"
                value={<span className="mono">{formatReviewInr(profile.netMonthlyIncome)}</span>}
                tone={salaryFlag ? 'flag' : undefined}
                sub={salaryFlag ? 'Below threshold' : undefined}
              />
            ) : null}
            {usesAnnualFinancialMetric(occupationKey) ? (
              <>
                <ReviewField label="Annual turnover" value={<span className="mono">{formatReviewInr(profile.annualTurnover)}</span>} />
                <ReviewField label="Annual profit" value={<span className="mono">{formatReviewInr(profile.annualProfit)}</span>} />
              </>
            ) : null}
          </div>
        </ReviewCard>

        <ReviewCard icon={<IdCardIcon />} title="Aadhaar (DigiLocker)">
          {hasAadhaar ? (
            <div className="fgrid">
              <ReviewField label="Aadhaar name" value={formatPersonName(aadhaar?.fullName)} />
              <ReviewField label="Aadhaar DOB" value={formatDobWithAge(aadhaar?.dateOfBirth)} />
              <ReviewField label="Aadhaar gender" value={normalizeAadhaarGender(aadhaar?.gender) ?? '—'} />
              <ReviewField label="Aadhaar number" value={formatAadhaarNumberDisplay(aadhaar?.maskedAadhaar, true)} />
              <ReviewField label="Aadhaar address" value={aadhaar?.address ?? '—'} />
            </div>
          ) : (
            <ReviewEmptyState title="Aadhaar not fetched" subtitle="DigiLocker Aadhaar data is not available for this application yet." />
          )}
        </ReviewCard>
      </div>

      <ReviewCard
        icon={<PersonIcon />}
        title="Identity verification matrix"
        right={<ReviewPill tone="info">Profile · Aadhaar · CIBIL</ReviewPill>}
      >
        <IdentityMatrix rows={matrixRows} />
      </ReviewCard>

      <div className="ar-personal-row">
        <ReviewCard icon={<MapPinIcon />} title="Address">
          <CompactAddressBlock
            addressLine1={profile.addressLine1}
            addressLine2={profile.addressLine2}
            city={profile.city}
            state={profile.state}
            pincode={profile.pincode}
          />
        </ReviewCard>

        <ReviewCard
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 21h18M5 21V10M19 21V10M3 10l9-6 9 6" />
            </svg>
          }
          title="Government IDs (CIBIL)"
        >
          <GovernmentIdsBlock
            loading={loading}
            error={error}
            otherIds={otherIds}
            hasBureauReport={Boolean(row.bureauReport)}
            pan={pan}
          />
        </ReviewCard>
      </div>

      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        }
        title="CIBIL contact details"
      >
          {loading ? <p style={{ margin: 0, color: 'var(--ink-3)' }}>Loading CIBIL contacts…</p> : null}
          {error ? <p style={{ margin: 0, color: 'var(--bad)' }}>{error}</p> : null}
          {cibilReport ? (
            <>
              {dedupeCibilPhones(cibilReport.phones).length > 0 ? (
                <>
                  <ReviewSectionLabel first>Mobile numbers</ReviewSectionLabel>
                  <div className="fgrid">
                    {dedupeCibilPhones(cibilReport.phones).map((phone) => (
                      <ReviewField key={phone.number} label={phone.label} value={<span className="mono">{phone.number}</span>} />
                    ))}
                  </div>
                </>
              ) : cibilReport.primaryMobile ? (
                <ReviewField label="Mobile number" value={<span className="mono">{cibilReport.primaryMobile}</span>} />
              ) : null}
              {cibilReport.emails.length > 0 ? (
                <>
                  <ReviewSectionLabel>Email IDs</ReviewSectionLabel>
                  <div className="fgrid">
                    {cibilReport.emails.map((email, index) => (
                      <ReviewField
                        key={email}
                        label={cibilReport.emails.length > 1 ? `Email ${index + 1}` : 'Email'}
                        value={email}
                      />
                    ))}
                  </div>
                </>
              ) : null}
              {!cibilReport.phones.length && !cibilReport.primaryMobile && !cibilReport.emails.length ? (
                <ReviewEmptyState title="No contacts on bureau" subtitle="The CIBIL report has no phone or email records." />
              ) : null}
            </>
          ) : !loading && !row.bureauReport ? (
            <ReviewEmptyState title="No bureau pull" subtitle="CIBIL contact details appear after the bureau report is fetched." />
          ) : null}
        </ReviewCard>
    </div>
  );
}

export function ReviewCibilPanel({
  row,
  applicationUuid,
  onReportCreated,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  onReportCreated?: () => void;
}) {
  const score = row.bureauReport?.cibilScore ?? row.eligibility?.cibilScore ?? null;

  return (
    <>
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 3 3 5-6" />
          </svg>
        }
        title="Credit bureau summary"
      >
        <div className="fgrid thirds">
          <ReviewField label="CIBIL score" value={score ?? '—'} tone={score != null && score >= 700 ? 'accent' : undefined} sub={cibilScoreBand(score)} />
          <ReviewField label="Bureau" value="TransUnion CIBIL" />
          <ReviewField label="Pulled" value={formatReviewDateOnly(row.bureauReport?.fetchedAt)} />
        </div>
      </ReviewCard>
      <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--line)' }}>
        <ApplicationCibilReportTab applicationUuid={applicationUuid} onReportCreated={onReportCreated} />
      </div>
    </>
  );
}

export function ReviewReferencesPanel({ row }: { row: LosApplicationDetails }) {
  const pending = row.references.length < 2;
  return (
    <ReviewCard
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a6 6 0 0 1 11 0" />
        </svg>
      }
      title="References"
      right={pending ? <ReviewPill tone="warn">Current step</ReviewPill> : <ReviewPill tone="ok">{row.references.length} saved</ReviewPill>}
    >
      {row.references.length === 0 ? (
        <ReviewEmptyState title="References pending collection" subtitle="Captured references and verification calls appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {row.references.map((ref) => (
            <div key={`${ref.referenceIndex}-${ref.mobileNumber}`} className="doc">
              <div className="doc-name" style={{ marginBottom: 10 }}>
                Reference {ref.referenceIndex + 1}
              </div>
              <div className="fgrid">
                <ReviewField label="Name" value={formatPersonName(ref.fullName)} />
                <ReviewField label="Mobile" value={<span className="mono">{ref.mobileNumber}</span>} />
                <ReviewField label="Relation" value={ref.relation} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ReviewCard>
  );
}

export function ReviewSourcesPanel({ row }: { row: LosApplicationDetails }) {
  const utms = row.lead.utms ?? [];
  const latest = utms[0];

  return (
    <>
      <ReviewCard
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
          </svg>
        }
        title="Acquisition source"
      >
        <div className="fgrid thirds">
          <ReviewField label="Attribution" value={row.lead.sourceName ?? 'Unattributed'} />
          <ReviewField label="Source type" value={row.lead.sourceType ?? '—'} />
          <ReviewField label="UTM captures" value={String(utms.length)} />
          <ReviewField label="UTM source" value={latest?.source ?? '—'} />
          <ReviewField label="UTM medium" value={latest?.medium ?? '—'} />
          <ReviewField label="UTM campaign" value={latest?.campaign ?? '—'} />
        </div>
      </ReviewCard>
      {utms.length > 1 ? (
        <ReviewCard title="UTM history" icon={<span style={{ fontSize: 12, fontWeight: 800 }}>UTM</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {utms.map((utm, index) => (
              <div key={`${utm.capturedAt}-${index}`} className="doc">
                <div className="doc-sub" style={{ marginBottom: 8 }}>
                  {formatReviewDateTime(utm.capturedAt)}
                </div>
                <div className="fgrid thirds">
                  <ReviewField label="Source" value={utm.source ?? '—'} />
                  <ReviewField label="Medium" value={utm.medium ?? '—'} />
                  <ReviewField label="Campaign" value={utm.campaign ?? '—'} />
                </div>
              </div>
            ))}
          </div>
        </ReviewCard>
      ) : null}
    </>
  );
}
