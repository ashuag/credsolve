'use client';

import { ApplicationCibilReportTab } from '@/components/applications/application-cibil-report-tab';
import { KycComparedValue } from '@/components/applications/kyc-field-match-badge';
import { cx } from '@/components/eligibility/eligibility-ui';
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
} from '@/lib/kyc-field-match';
import {
  explainKycNotDone,
} from '@/lib/kyc-selfie-validation-display';
import { formatPersonName } from '@/lib/format-person-name';
import {
  fetchApplicationLoanDocumentBlob,
  generateApplicationLoanDocuments,
  getApplicationCibilReport,
  type CibilReportData,
  type LosApplicationDetails,
} from '@/lib/api';
import { KycEnableReKycButton } from '@/components/applications/kyc-enable-re-kyc-button';
import { GrantPennyDropAttemptButton } from '@/components/applications/grant-penny-drop-attempt-button';
import { PennyDropAttemptHistory } from '@/components/applications/penny-drop-attempt-history';
import { canEnableReKycFromRow } from '@/lib/kyc-grant-retry-eligibility';
import { BANK_DETAIL_FAILED_LABEL, canGrantPennyDropAttemptFromRow, isBankDetailFailed } from '@/lib/penny-drop-grant-retry-eligibility';
import { KycPipelineSteps } from '@/components/applications/kyc-pipeline-steps';
import { KycPhotoGallery } from '@/components/shared/kyc-photo-gallery';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

type OverviewTab = 'profile' | 'cibil' | 'loan' | 'kyc' | 'bank' | 'references' | 'sources';

function DetailGrid({
  rows,
  columns = 1,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  if (columns === 1) {
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

  const gridClass = columns === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <dl className={`m-0 grid gap-2 ${gridClass}`}>
      {rows.map((row, idx) => (
        <div
          key={`${row.label}-${idx}`}
          className="rounded-[8px] border border-[rgba(23,44,113,0.07)] bg-[rgba(255,255,255,0.72)] px-3 py-2"
        >
          <dt className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-brand-muted leading-tight">{row.label}</dt>
          <dd className="m-0 mt-1 break-words text-[0.84rem] font-semibold text-brand-text leading-snug">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileSubheading({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">{children}</p>
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

function formatInr(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function buildEmploymentRows(profile: NonNullable<LosApplicationDetails['lead']['profile']>) {
  return [
    { label: 'Occupation', value: profile.occupation ?? '—' },
    { label: 'Monthly income', value: formatInr(profile.netMonthlyIncome) },
  ];
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)]">
      <div className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)] px-3 py-2">
        <span className="text-[0.82rem] font-extrabold text-brand-navy">{title}</span>
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

function CibilPersonalDetailsBlock({
  bureauReportAvailable,
  cibilLoading,
  cibilError,
  cibilReport,
}: {
  bureauReportAvailable: boolean;
  cibilLoading: boolean;
  cibilError: string | null;
  cibilReport: CibilReportData | null;
}) {
  if (!bureauReportAvailable) {
    return <p className="m-0 text-[0.84rem] text-brand-muted">No CIBIL report available yet.</p>;
  }

  if (cibilLoading) {
    return <p className="m-0 text-[0.84rem] text-brand-muted">Loading CIBIL details…</p>;
  }

  if (cibilError) {
    return <p className="m-0 text-[0.84rem] text-[#8d3434]">{cibilError}</p>;
  }

  if (!cibilReport) {
    return <p className="m-0 text-[0.84rem] text-brand-muted">CIBIL details are not available.</p>;
  }

  const phoneRows =
    cibilReport.phones.length > 0
      ? dedupeCibilPhones(cibilReport.phones).map((phone) => ({
          label: phone.label,
          value: phone.number,
        }))
      : cibilReport.primaryMobile
        ? [{ label: 'Mobile number', value: cibilReport.primaryMobile }]
        : [];

  const emailRows = cibilReport.emails.map((email, index) => ({
    label: cibilReport.emails.length > 1 ? `Email ${index + 1}` : 'Email',
    value: email,
  }));

  const identifierRows = cibilReport.identifiers.map((identifier) => ({
    label: identifier.type,
    value: identifier.number,
  }));

  const hasContact = phoneRows.length > 0 || emailRows.length > 0;

  if (!hasContact) {
    return <p className="m-0 text-[0.84rem] text-brand-muted">No contact details found on the CIBIL report.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {phoneRows.length > 0 ? (
        <div className="min-w-0">
          <ProfileSubheading>Mobile numbers</ProfileSubheading>
          <div className="mt-2">
            <DetailGrid rows={phoneRows} columns={1} />
          </div>
        </div>
      ) : null}
      {emailRows.length > 0 ? (
        <div className="min-w-0">
          <ProfileSubheading>Email IDs</ProfileSubheading>
          <div className="mt-2">
            <DetailGrid rows={emailRows} columns={1} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CibilGovernmentIdsBlock({
  bureauReportAvailable,
  cibilLoading,
  cibilError,
  cibilReport,
  profilePan,
}: {
  bureauReportAvailable: boolean;
  cibilLoading: boolean;
  cibilError: string | null;
  cibilReport: CibilReportData | null;
  profilePan?: string | null;
}) {
  if (!bureauReportAvailable) {
    return <p className="m-0 text-[0.84rem] text-brand-muted">Available after CIBIL report is pulled.</p>;
  }

  if (cibilLoading) {
    return <p className="m-0 text-[0.84rem] text-brand-muted">Loading government IDs…</p>;
  }

  if (cibilError) {
    return <p className="m-0 text-[0.84rem] text-[#8d3434]">{cibilError}</p>;
  }

  const identifierRows =
    cibilReport?.identifiers
      .filter((identifier) => {
        const bureauPan = extractCibilPan([identifier]);
        if (!bureauPan || !profilePan) return true;
        return bureauPan !== profilePan.trim().toUpperCase();
      })
      .map((identifier) => ({
        label: identifier.type,
        value: identifier.number,
      })) ?? [];

  if (identifierRows.length === 0) {
    return (
      <p className="m-0 text-[0.84rem] text-brand-muted">
        {profilePan?.trim()
          ? 'No additional government IDs on the CIBIL report (PAN shown above).'
          : 'No government IDs found on the CIBIL report.'}
      </p>
    );
  }

  return <DetailGrid rows={identifierRows} columns={3} />;
}

function CustomerProfilePanel({
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
  const pan = profile?.panNumber?.trim() || row.lead.panNumber?.trim() || '—';
  const [cibilReport, setCibilReport] = useState<CibilReportData | null>(null);
  const [cibilLoading, setCibilLoading] = useState(false);
  const [cibilError, setCibilError] = useState<string | null>(null);

  const loadCibilDetails = useCallback(async () => {
    if (!authToken || !row.bureauReport) {
      setCibilReport(null);
      setCibilError(null);
      setCibilLoading(false);
      return;
    }

    setCibilLoading(true);
    setCibilError(null);
    try {
      const payload = await getApplicationCibilReport(authToken, applicationUuid);
      setCibilReport(payload.report);
    } catch (error) {
      setCibilReport(null);
      setCibilError(error instanceof Error ? error.message : 'Failed to load CIBIL details.');
    } finally {
      setCibilLoading(false);
    }
  }, [applicationUuid, authToken, row.bureauReport]);

  useEffect(() => {
    void loadCibilDetails();
  }, [loadCibilDetails]);

  if (!profile) {
    return <p className="m-0 text-[0.88rem] text-brand-muted">No lead profile is linked to this application yet.</p>;
  }

  const hasAadhaar =
    aadhaar &&
    (aadhaar.fullName?.trim() ||
      aadhaar.dateOfBirth ||
      aadhaar.gender?.trim() ||
      aadhaar.maskedAadhaar?.trim() ||
      aadhaar.address?.trim());

  const bureauPan = cibilReport ? extractCibilPan(cibilReport.identifiers) : null;
  const profileNameScore = computeNameMatchScore(profile.fullName, aadhaar?.fullName);
  const profileNameVerdict = nameMatchVerdict(profileNameScore, Boolean(profile.fullName?.trim() && aadhaar?.fullName?.trim()));
  const profileDobVerdict = compareIsoDates(profile.dateOfBirth, aadhaar?.dateOfBirth);
  const profileGenderVerdict = compareGenders(profile.gender, aadhaar?.gender);
  const panBureauVerdict = comparePan(pan, bureauPan);
  const cibilNameScore = computeNameMatchScore(profile.fullName, cibilReport?.consumerName);
  const cibilNameVerdict = nameMatchVerdict(
    cibilNameScore,
    Boolean(profile.fullName?.trim() && cibilReport?.consumerName?.trim()),
  );
  const cibilDobVerdict = compareIsoDates(profile.dateOfBirth, cibilReport?.dateOfBirth);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileSection title="Personal details">
          <DetailGrid
            columns={2}
            rows={[
              {
                label: 'Name',
                value: (
                  <KycComparedValue
                    value={formatPersonName(profile.fullName)}
                    verdict={profileNameVerdict}
                    score={profileNameScore}
                    compareLabel="Aadhaar"
                  />
                ),
              },
              {
                label: 'Date of birth',
                value: (
                  <KycComparedValue
                    value={formatDobWithAge(profile.dateOfBirth)}
                    verdict={profileDobVerdict}
                    compareLabel="Aadhaar"
                  />
                ),
              },
              {
                label: 'Gender',
                value: (
                  <KycComparedValue
                    value={profile.gender ?? '—'}
                    verdict={profileGenderVerdict}
                    compareLabel="Aadhaar"
                  />
                ),
              },
              {
                label: 'PAN card',
                value: (
                  <KycComparedValue
                    value={pan}
                    verdict={panBureauVerdict}
                    compareLabel="CIBIL"
                  />
                ),
              },
            ]}
          />
          <div className="mt-3 border-t border-[rgba(23,44,113,0.06)] pt-3">
            <ProfileSubheading>Aadhaar details (DigiLocker)</ProfileSubheading>
            {hasAadhaar ? (
              <div className="mt-2">
                <DetailGrid
                  columns={2}
                  rows={[
                    { label: 'Aadhaar name', value: formatPersonName(aadhaar?.fullName) },
                    { label: 'Aadhaar DOB', value: formatDobWithAge(aadhaar?.dateOfBirth) },
                    { label: 'Aadhaar gender', value: normalizeAadhaarGender(aadhaar?.gender) ?? '—' },
                    {
                      label: 'Aadhaar number',
                      value: formatAadhaarNumberDisplay(aadhaar?.maskedAadhaar, true),
                    },
                    { label: 'Aadhaar address', value: aadhaar?.address ?? '—' },
                  ]}
                />
              </div>
            ) : (
              <p className="m-0 mt-2 text-[0.84rem] text-brand-muted">Not fetched from DigiLocker yet.</p>
            )}
          </div>
          {cibilReport ? (
            <div className="mt-3 border-t border-[rgba(23,44,113,0.06)] pt-3">
              <ProfileSubheading>CIBIL identity match</ProfileSubheading>
              <div className="mt-2">
                <DetailGrid
                  columns={2}
                  rows={[
                    {
                      label: 'Bureau name',
                      value: (
                        <KycComparedValue
                          value={formatPersonName(cibilReport.consumerName)}
                          verdict={cibilNameVerdict}
                          score={cibilNameScore}
                          compareLabel="Profile"
                        />
                      ),
                    },
                    {
                      label: 'Bureau DOB',
                      value: (
                        <KycComparedValue
                          value={formatDobWithAge(cibilReport.dateOfBirth)}
                          verdict={cibilDobVerdict}
                          compareLabel="Profile"
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          ) : null}
          <div className="mt-3 border-t border-[rgba(23,44,113,0.06)] pt-3">
            <ProfileSubheading>Other government IDs (CIBIL)</ProfileSubheading>
            <div className="mt-2">
              <CibilGovernmentIdsBlock
                bureauReportAvailable={Boolean(row.bureauReport)}
                cibilLoading={cibilLoading}
                cibilError={cibilError}
                cibilReport={cibilReport}
                profilePan={pan !== '—' ? pan : null}
              />
            </div>
          </div>
        </ProfileSection>

        <div className="grid gap-4">
          <ProfileSection title="Employment details">
            <DetailGrid columns={2} rows={buildEmploymentRows(profile)} />
          </ProfileSection>

          <ProfileSection title="Address">
            <DetailGrid
              columns={2}
              rows={[
                { label: 'Address line 1', value: profile.addressLine1 ?? '—' },
                { label: 'Address line 2', value: profile.addressLine2 ?? '—' },
                { label: 'City', value: profile.city ?? '—' },
                { label: 'State', value: profile.state ?? '—' },
                { label: 'Pincode', value: profile.pincode ?? '—' },
              ]}
            />
          </ProfileSection>
        </div>
      </div>

      <ProfileSection title="CIBIL details">
        <CibilPersonalDetailsBlock
          bureauReportAvailable={Boolean(row.bureauReport)}
          cibilLoading={cibilLoading}
          cibilError={cibilError}
          cibilReport={cibilReport}
        />
      </ProfileSection>
    </div>
  );
}

function LoanDocumentCard({
  label,
  ready,
  esigned,
  docType,
  applicationUuid,
  token,
}: {
  label: string;
  ready: boolean;
  esigned: boolean;
  docType: 'key-fact' | 'key-fact-disbursement';
  applicationUuid: string;
  token: string | null;
}) {
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const handleView = async () => {
    if (!token) return;
    setOpening(true);
    setOpenError(null);
    try {
      const blob = await fetchApplicationLoanDocumentBlob(token, applicationUuid, docType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'Failed to open document.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)] px-3 py-2.5">
      <span className="block text-[0.78rem] font-extrabold text-brand-navy">{label}</span>
      {ready ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[0.72rem] font-bold text-[#14523a]">Ready</span>
          {esigned ? (
            <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[rgba(29,157,112,0.3)] bg-[rgba(29,157,112,0.08)] px-1.5 py-0.5 text-[0.65rem] font-extrabold text-[#14523a]">
              ✓ E-Signed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-[5px] border border-[rgba(180,100,0,0.25)] bg-[rgba(255,160,0,0.08)] px-1.5 py-0.5 text-[0.65rem] font-extrabold text-[#7a4800]">
              Not E-Signed
            </span>
          )}
          <button
            type="button"
            disabled={opening || !token}
            onClick={() => void handleView()}
            className="inline-flex items-center gap-1 rounded-[6px] border border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.07)] px-2 py-0.5 text-[0.68rem] font-bold text-brand-blue disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[rgba(20,150,243,0.13)]"
          >
            {opening ? 'Opening…' : 'View PDF'}
          </button>
          {openError ? <span className="text-[0.68rem] font-semibold text-[#8d3434]">{openError}</span> : null}
        </div>
      ) : (
        <span className="mt-0.5 block text-[0.72rem] font-bold text-brand-muted">Not generated yet</span>
      )}
    </div>
  );
}

function LoanDetailsPanel({
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
  const details = row.details;
  const sanctionReviewed = Boolean(row.loanDocuments.reviewedAt ?? row.loanDocuments.acceptedAt);
  const sanctionAccepted = Boolean(row.loanDocuments.acceptedAt);

  if (!details) {
    return <p className="m-0 text-[0.88rem] text-brand-muted">No loan selection has been saved yet.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <ProfileSection title="Loan amounts">
          <DetailGrid
            columns={2}
            rows={[
              { label: 'Pre-approved amount', value: formatInr(row.preApprovedLoanAmount) },
              { label: 'Selected loan amount', value: formatInr(details.loanAmount) },
              {
                label: 'Tenure',
                value: details.loanTenure != null ? `${details.loanTenure} days` : '—',
              },
              { label: 'Repay date', value: formatDateOnly(details.loanMaturityDate) },
              { label: 'Net to bank', value: formatInr(details.disbursedAmount) },
              { label: 'Repay amount', value: formatInr(details.repaymentAmount) },
            ]}
          />
        </ProfileSection>

        <ProfileSection title="Interest & fees">
          <DetailGrid
            columns={2}
            rows={[
              { label: 'ROI %', value: details.interestRate != null ? `${details.interestRate}%` : '—' },
              { label: 'ROI amount', value: formatInr(details.interestAmount) },
              { label: 'Processing fee %', value: details.processingFee != null ? `${details.processingFee}%` : '—' },
              { label: 'Processing fee amount', value: formatInr(details.processingFeeAmount) },
              { label: 'GST %', value: details.gstPercent != null ? `${details.gstPercent}%` : '—' },
              { label: 'GST amount', value: formatInr(details.gstAmount) },
            ]}
          />
        </ProfileSection>

        <ProfileSection title="Sanction letter">
          <DetailGrid
            columns={2}
            rows={[
              { label: 'Letter reviewed', value: sanctionReviewed ? 'Yes' : 'No' },
              { label: 'Letter reviewed at', value: formatDateTime(row.loanDocuments.reviewedAt) },
              { label: 'Sanction OTP verified', value: sanctionAccepted ? 'Yes' : 'No' },
              { label: 'Sanction OTP verified at', value: formatDateTime(row.loanDocuments.acceptedAt) },
            ]}
          />
        </ProfileSection>
      </div>

      <ProfileSection title="Loan documents">
        <ProfileSubheading>Generate sanction letter</ProfileSubheading>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
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
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border border-[rgba(23,44,113,0.18)] bg-[rgba(23,44,113,0.06)] px-4 text-[0.82rem] font-bold text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatingDocs ? 'Generating…' : 'Generate PDFs'}
          </button>
          {row.lead.profile?.fullName && row.details?.loanAmount ? null : (
            <span className="text-[0.78rem] text-[#b45309]">Loan selection must be complete before generating.</span>
          )}
          {docsActionResult ? (
            <span
              className={`text-[0.78rem] font-semibold ${docsActionResult.startsWith('Generated') ? 'text-[#14523a]' : 'text-[#8d3434]'}`}
            >
              {docsActionResult}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2">
          <LoanDocumentCard
            label="Sanction letter cum KFS (KYC / acceptance)"
            ready={row.loanDocuments.keyFactReady}
            esigned={row.loanDocuments.keyFactEsigned}
            docType="key-fact"
            applicationUuid={applicationUuid}
            token={authToken}
          />
          {row.loanDocuments.reviewedAt ? (
            <div className="rounded-[10px] border border-[rgba(29,157,112,0.2)] bg-[rgba(29,157,112,0.06)] px-3 py-2.5">
              <span className="block text-[0.72rem] font-extrabold text-brand-muted">Reviewed by customer</span>
              <span className="block text-[0.78rem] font-bold text-[#14523a]">{formatDateTime(row.loanDocuments.reviewedAt)}</span>
            </div>
          ) : null}
          {row.loanDocuments.acceptedAt ? (
            <div className="rounded-[10px] border border-[rgba(29,157,112,0.2)] bg-[rgba(29,157,112,0.06)] px-3 py-2.5">
              <span className="block text-[0.72rem] font-extrabold text-brand-muted">Sanction OTP verified</span>
              <span className="block text-[0.78rem] font-bold text-[#14523a]">{formatDateTime(row.loanDocuments.acceptedAt)}</span>
            </div>
          ) : null}
          {row.loanDocuments.keyFactDisbursementReady || row.statusCode === 'DISBURSED' || row.loanAccount ? (
            <LoanDocumentCard
              label="Sanction letter cum KFS (disbursement)"
              ready={row.loanDocuments.keyFactDisbursementReady}
              esigned={row.loanDocuments.keyFactDisbursementEsigned}
              docType="key-fact-disbursement"
              applicationUuid={applicationUuid}
              token={authToken}
            />
          ) : null}
        </div>
      </ProfileSection>
    </div>
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

function KycDetailPanel({
  row,
  applicationUuid,
  authToken,
  onRefresh,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
  onRefresh?: () => void;
}) {
  const kycNotDoneReason = explainKycNotDone(row);
  const showEnableReKyc = row.canEnableReKyc || canEnableReKycFromRow(row);
  return (
    <div className="grid gap-4">
      {kycNotDoneReason ? (
        <p className="m-0 rounded-[10px] border border-[rgba(245,158,11,0.35)] bg-[rgba(255,251,235,0.9)] px-3 py-2.5 text-[0.84rem] leading-[1.45] text-[#92400e]">
          {kycNotDoneReason}
        </p>
      ) : null}
      {showEnableReKyc ? (
        <div className="grid gap-2.5">
          <KycEnableReKycButton
            row={row}
            applicationUuid={applicationUuid}
            authToken={authToken}
            onSuccess={onRefresh}
          />
        </div>
      ) : null}
      <div>
        <p className="m-0 mb-2 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
          KYC photos &amp; video
        </p>
        <KycPhotoGallery row={row} authToken={authToken} />
      </div>
      <KycPipelineSteps row={row} variant="overview" />
      <DetailGrid
        rows={[
          { label: 'KYC status', value: `${row.kycStatusLabel} (${row.kycStatus})` },
          { label: 'KYC completed at', value: formatDateTime(row.kycCompletedAt) },
          {
            label: 'KYC pipeline passed',
            value: row.livenessPassed ? 'Yes' : 'No',
          },
          {
            label: 'DigiLocker PAN',
            value: row.digilockerPan?.panCardNumber ?? '—',
          },
          {
            label: 'DigiLocker PAN verified at',
            value: formatDateTime(row.digilockerPan?.panCardVerifiedAt ?? null),
          },
          {
            label: 'DigiLocker Aadhaar',
            value: row.aadhaarDetail?.maskedAadhaar ?? '—',
          },
          { label: 'Selfie quality checked at', value: formatDateTime(row.selfieFaceValidation?.checkedAt ?? null) },
          { label: 'Liveness checked at', value: formatDateTime(row.livenessCheckedAt) },
          {
            label: 'Face match checked at',
            value: formatDateTime(
              row.moneyCashFaceMatch?.reason?.startsWith('Pending') ||
                row.moneyCashFaceMatch?.reason?.startsWith('Skipped')
                ? null
                : row.moneyCashFaceMatch?.checkedAt,
            ),
          },
        ]}
      />

      {row.agreement ? (
        <div className="overflow-hidden rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)]">
          <div className="flex items-center gap-2 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)] px-3 py-2">
            <span className="text-[0.58rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Agreement</span>
            <span className="w-px h-3 bg-[rgba(23,44,113,0.1)]" aria-hidden />
            <span className="text-[0.82rem] font-extrabold text-brand-navy">E-sign & legal</span>
          </div>
          <div className="px-3 py-2.5">
            <DetailGrid
              rows={[
                { label: 'Document', value: row.agreement.documentName ?? '—' },
                { label: 'Signed at', value: formatDateTime(row.agreement.signedAt ?? undefined) },
                { label: 'IP address', value: row.agreement.ipAddress ?? '—' },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function leadSourceSummary(sourceName: string | null | undefined, sourceType: string | null | undefined): string {
  if (!sourceName) return 'Unattributed';
  return sourceType ? `${sourceName} · ${sourceType}` : sourceName;
}

function formatLeadSourceType(type: string | null | undefined) {
  if (!type) return '—';
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SourcesUtmPanel({ row }: { row: LosApplicationDetails }) {
  const utms = row.lead.utms ?? [];

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)]">
        <div className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)] px-3 py-2">
          <span className="text-[0.82rem] font-extrabold text-brand-navy">Lead source</span>
        </div>
        <div className="px-3 py-2.5">
          <DetailGrid
            rows={[
              { label: 'Source name', value: row.lead.sourceName ?? 'Unattributed' },
              { label: 'Source type', value: formatLeadSourceType(row.lead.sourceType) },
              { label: 'Attribution', value: leadSourceSummary(row.lead.sourceName, row.lead.sourceType) },
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[rgba(23,44,113,0.08)]">
        <div className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)] px-3 py-2">
          <span className="text-[0.82rem] font-extrabold text-brand-navy">UTM tags</span>
          <span className="ml-2 text-[0.76rem] font-semibold text-brand-muted">
            {utms.length} capture{utms.length === 1 ? '' : 's'}
          </span>
        </div>
        {utms.length === 0 ? (
          <p className="m-0 px-3 py-4 text-[0.88rem] text-brand-muted">No UTM parameters captured for this lead.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.84rem]">
              <thead>
                <tr className="bg-[rgba(23,44,113,0.04)]">
                  {['Captured at', 'Source', 'Medium', 'Campaign', 'Term', 'Content'].map((label) => (
                    <th
                      key={label}
                      className="border-b border-[rgba(23,44,113,0.08)] px-3 py-2 text-left text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {utms.map((utm, index) => (
                  <tr key={`${utm.capturedAt}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-[rgba(248,250,255,0.55)]'}>
                    <td className="border-b border-[rgba(23,44,113,0.04)] px-3 py-2.5 font-semibold text-brand-text whitespace-nowrap">
                      {formatDateTime(utm.capturedAt)}
                    </td>
                    {[utm.source, utm.medium, utm.campaign, utm.term, utm.content].map((value, cellIndex) => (
                      <td key={cellIndex} className="border-b border-[rgba(23,44,113,0.04)] px-3 py-2.5">
                        {value ? (
                          <span className="inline-block rounded-[6px] bg-[rgba(59,130,246,0.08)] px-2 py-0.5 font-semibold text-[0.81rem] text-[#1e40af]">
                            {value}
                          </span>
                        ) : (
                          <span className="text-brand-muted">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BankDetailsPanel({
  row,
  applicationUuid,
  authToken,
  onRefresh,
}: {
  row: LosApplicationDetails;
  applicationUuid: string;
  authToken: string | null;
  onRefresh?: () => void;
}) {
  const bank = row.disbursement;
  const hasBank = Boolean(bank?.accountNumber?.trim() || bank?.ifscCode?.trim());
  const attempts = row.pennyDropVerification;
  const showGrant = row.canGrantPennyDropAttempt || canGrantPennyDropAttemptFromRow(row);
  const bankFailed = isBankDetailFailed(row);

  return (
    <div className="grid gap-4">
      <GrantPennyDropAttemptButton
        row={row}
        applicationUuid={applicationUuid}
        authToken={authToken}
        onSuccess={onRefresh}
      />
      {attempts ? (
        <DetailGrid
          rows={[
            {
              label: 'Penny-drop attempts',
              value: `${attempts.attemptsUsed} / ${attempts.attemptsAllowed}${
                attempts.retryLimitReached && !attempts.bankVerified ? ' (exhausted)' : ''
              }`,
            },
            ...(row.bankAccountAttempts?.[0]?.nameMatchScore != null
              ? [
                  {
                    label: 'Name match score',
                    value: `${row.bankAccountAttempts[0].nameMatchScore}%${
                      row.statusCode.toUpperCase() === 'UNDER_REVIEW' ? ' (under review)' : ''
                    }`,
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      <PennyDropAttemptHistory attempts={row.bankAccountAttempts} />
      {!hasBank ? (
        <p className="m-0 text-[0.88rem] text-brand-muted">
          {bankFailed
            ? BANK_DETAIL_FAILED_LABEL
            : showGrant
              ? 'The customer used all bank verification attempts. Grant one more so they can retry penny drop.'
              : 'Bank details have not been submitted yet.'}
        </p>
      ) : (
        <DetailGrid
          rows={[
            { label: 'Bank name', value: bank?.bankName ?? '—' },
            { label: 'Account number', value: bank?.accountNumber ?? '—' },
            { label: 'IFSC', value: bank?.ifscCode ?? '—' },
            { label: 'Disbursement amount', value: formatInr(bank?.disburseAmount ?? bank?.amount) },
            { label: 'Expected repay date', value: formatDateOnly(bank?.expectedRepaymentDate) },
            { label: 'Repayment amount', value: formatInr(bank?.repaymentAmount) },
            { label: 'Disbursed at', value: formatDateTime(bank?.disbursedAt) },
          ]}
        />
      )}
    </div>
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

  const tabs: Array<{ id: OverviewTab; label: string }> = [
    { id: 'profile', label: 'Personal details' },
    { id: 'cibil', label: 'CIBIL report' },
    { id: 'loan', label: 'Loan details' },
    { id: 'kyc', label: 'KYC detail' },
    { id: 'bank', label: 'Bank details' },
    { id: 'references', label: 'Reference details' },
    { id: 'sources', label: 'Sources & UTMs' },
  ];

  return (
    <section
      className="overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.09)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))' }}
    >
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
        {activeTab === 'profile' ? (
          <CustomerProfilePanel row={row} applicationUuid={applicationUuid} authToken={authToken} />
        ) : null}
        {activeTab === 'cibil' ? (
          <ApplicationCibilReportTab applicationUuid={applicationUuid} onReportCreated={onReportCreated} />
        ) : null}
        {activeTab === 'loan' ? (
          <LoanDetailsPanel
            row={row}
            applicationUuid={applicationUuid}
            authToken={authToken}
            onDataChange={onReportCreated}
          />
        ) : null}
        {activeTab === 'kyc' ? (
          <KycDetailPanel
            row={row}
            applicationUuid={applicationUuid}
            authToken={authToken}
            onRefresh={onReportCreated}
          />
        ) : null}
        {activeTab === 'bank' ? (
          <BankDetailsPanel
            row={row}
            applicationUuid={applicationUuid}
            authToken={authToken}
            onRefresh={onReportCreated}
          />
        ) : null}
        {activeTab === 'references' ? <ReferenceDetailsPanel row={row} /> : null}
        {activeTab === 'sources' ? <SourcesUtmPanel row={row} /> : null}
      </div>
    </section>
  );
}
