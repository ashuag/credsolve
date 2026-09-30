'use client';

import { CheckCibilScorePanel, CibilHitLogsPanel } from '@/components/applications/check-cibil-score-panel';
import { CibilReportViewer } from '@/components/applications/cibil-report-viewer';
import { cx } from '@/components/eligibility/eligibility-ui';
import { PostBreResultsSummary } from '@/components/eligibility/post-bureau-bre-panel';
import {
  getApplicationCibilReport,
  getApplicationDetails,
  getLeadCibilReport,
  resolveLosKycPhotoSrc,
  runPostBureauBreCheck,
  type LosApplicationCibilReportPayload,
  type LosCheckCibilResult,
  type PostBreDryRunResult,
} from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { useCallback, useEffect, useState } from 'react';

type CibilReportView = 'report' | 'bre' | 'hits';

type ApplicationCibilReportTabProps = {
  applicationUuid?: string;
  leadUuid?: string;
  mobileNumber?: string;
  fullName?: string | null;
  panNumber?: string | null;
  /** Called after a bureau pull succeeds so the parent can refresh summary data. */
  onReportCreated?: () => void;
};

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

function PostBreView({
  rawPayload,
  applicantMobile: applicantMobileProp,
  applicationUuid,
}: {
  rawPayload: unknown;
  applicantMobile?: string;
  applicationUuid?: string;
}) {
  const [result, setResult] = useState<PostBreDryRunResult | null>(null);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [applicantMobile, setApplicantMobile] = useState(applicantMobileProp?.trim() ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    const token = getToken();
    if (!token) { setError('Session expired — please log in again.'); return; }
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      setError('Raw bureau payload is not a valid object.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let mobile = applicantMobile.trim();
      if (!mobile && applicationUuid) {
        try {
          const details = await getApplicationDetails(token, applicationUuid);
          mobile = details.mobileNumber?.trim() ?? '';
          if (mobile) setApplicantMobile(mobile);
        } catch {
          // non-blocking — phone match will be skipped if mobile stays empty
        }
      }
      const res = await runPostBureauBreCheck(token, {
        bureauPayload: rawPayload as Record<string, unknown>,
        isExistingCustomer,
        applicantMobile: mobile || null,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Post-BRE check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="los-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="m-0 text-[0.95rem] font-extrabold text-brand-navy">Post-BRE eligibility check</h3>
          <p className="m-0 mt-0.5 text-[0.8rem] text-brand-muted">
            Dry-run inspector against the stored bureau payload. Use Check CIBIL score to persist rejection on failure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-bold text-brand-muted">Applicant mobile</span>
            <input
              type="text"
              inputMode="tel"
              className="los-input min-h-9 w-[11rem] font-mono text-[0.84rem]"
              value={applicantMobile}
              onChange={(e) => setApplicantMobile(e.target.value)}
              placeholder="9876543210"
              maxLength={20}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[0.84rem] font-semibold text-brand-navy">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-blue"
              checked={isExistingCustomer}
              onChange={(e) => setIsExistingCustomer(e.target.checked)}
            />
            Existing customer
          </label>
          <button
            type="button"
            className="los-btn-primary min-h-9.5 px-4"
            disabled={loading}
            onClick={() => void runCheck()}
          >
            {loading ? 'Running…' : result ? 'Re-run check' : 'Run post-BRE check'}
          </button>
        </div>
      </div>
      {error ? (
        <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-4 text-[0.86rem] text-[#8d3434]">
          {error}
        </div>
      ) : null}
      {result ? <PostBreResultsSummary result={result} /> : null}
    </div>
  );
}

export function ApplicationCibilReportTab({
  applicationUuid,
  leadUuid,
  mobileNumber,
  onReportCreated,
}: ApplicationCibilReportTabProps) {
  const [payload, setPayload] = useState<LosApplicationCibilReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingReport, setMissingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CibilReportView>('report');
  const [checkResult, setCheckResult] = useState<LosCheckCibilResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingReport(false);

    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      setPayload(null);
      setLoading(false);
      return;
    }

    if (!applicationUuid && !leadUuid) {
      setError('Missing application or lead reference.');
      setPayload(null);
      setLoading(false);
      return;
    }

    try {
      const data = applicationUuid
        ? await getApplicationCibilReport(token, applicationUuid)
        : await getLeadCibilReport(token, leadUuid!);
      setPayload(data);
    } catch (e) {
      setPayload(null);
      const message = e instanceof Error ? e.message : 'Failed to load CIBIL report.';
      if (/not found|no bureau|no stored json/i.test(message)) {
        setMissingReport(true);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [applicationUuid, leadUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleCibilChecked(result: LosCheckCibilResult) {
    setCheckResult(result);
    onReportCreated?.();
    void load();
  }

  if (loading) {
    return (
      <div className="los-card p-8">
        <div className="mx-auto max-w-md animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-[rgba(15,39,72,0.08)]" />
          <div className="h-24 rounded-xl bg-[rgba(15,39,72,0.05)]" />
          <div className="h-40 rounded-xl bg-[rgba(15,39,72,0.05)]" />
        </div>
      </div>
    );
  }

  if (missingReport) {
    return (
      <CheckCibilScorePanel
        applicationUuid={applicationUuid}
        leadUuid={leadUuid}
        emptyState
        lastResult={checkResult}
        onCompleted={handleCibilChecked}
      />
    );
  }

  if (error) {
    return (
      <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-6 text-[0.92rem] text-[#8d3434]">
        <strong className="font-extrabold">CIBIL report unavailable.</strong>
        <p className="m-0 mt-2 leading-relaxed">{error}</p>
        <button type="button" onClick={() => void load()} className="los-btn-primary mt-4 min-h-[38px] px-4">
          Retry
        </button>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="los-card p-6 text-[0.9rem] text-brand-muted">
        No bureau data is available for this application yet.
      </div>
    );
  }

  const pdfFallbackPath = applicationUuid
    ? `/applications/${encodeURIComponent(applicationUuid)}/cibil-report/pdf`
    : `/leads/${encodeURIComponent(leadUuid ?? '')}/cibil-report/pdf`;
  const pdfDownloadUrl =
    resolveLosKycPhotoSrc(
      payload.reportPdfUrl ?? pdfFallbackPath,
      getToken() ?? '',
    );

  const viewTabs: Array<{ id: CibilReportView; label: string }> = [
    { id: 'report', label: 'View CIBIL report' },
    { id: 'bre', label: 'Post BRE check' },
    { id: 'hits', label: 'CIBIL hit logs & JSON' },
  ];

  return (
    <div className="grid gap-4">
      <CheckCibilScorePanel
        applicationUuid={applicationUuid}
        leadUuid={leadUuid}
        compact
        hideHitLogs
        lastResult={checkResult}
        onCompleted={handleCibilChecked}
        buttonClassName="los-btn-primary min-h-[38px] shrink-0 whitespace-nowrap px-4 text-[0.82rem]"
        renderToolbarButton={(button) => (
          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="CIBIL report views"
          >
            <div className="los-card flex min-w-0 flex-wrap items-center gap-1 p-1.5">
              {viewTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id)}
                  className={cx(
                    'min-h-[38px] flex-1 whitespace-nowrap rounded-[10px] px-3 text-[0.82rem] font-extrabold transition-colors sm:flex-none sm:px-4',
                    activeView === tab.id
                      ? 'bg-brand-navy text-white shadow-sm'
                      : 'text-brand-navy hover:bg-[rgba(15,39,72,0.06)]',
                  )}
                  aria-current={activeView === tab.id ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {button}
              {pdfDownloadUrl ? (
                <a
                  href={pdfDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-[10px] border border-[rgba(15,39,72,0.12)] bg-white px-4 text-[0.82rem] font-bold text-brand-blue no-underline hover:border-[rgba(34,197,94,0.35)]"
                >
                  Download CIBIL report
                </a>
              ) : null}
            </div>
          </nav>
        )}
      />

      {activeView === 'report' ? <CibilReportViewer payload={payload} pdfDownloadUrl={pdfDownloadUrl} /> : null}
      {activeView === 'bre' ? (
        <PostBreView
          rawPayload={payload.rawPayload}
          applicantMobile={mobileNumber}
          applicationUuid={applicationUuid}
        />
      ) : null}
      {activeView === 'hits' ? (
        <CibilHitLogsPanel
          applicationUuid={applicationUuid}
          leadUuid={leadUuid}
          refreshKey={checkResult?.hitCount ?? payload.bureauReportUuid}
        />
      ) : null}
    </div>
  );
}
