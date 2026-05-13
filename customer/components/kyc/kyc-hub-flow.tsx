'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LoanSummaryLeftRail } from '@/components/loan/loan-summary-left-rail';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { initDigilockerSession, persistDigilockerSessionTokenForCallback } from '@/lib/api/digilocker';
import { getKycHubBackPath } from '@/lib/api/customer-session';
import { AlertBanner } from '@/components/ui/alert-banner';

function findRedirectUrl(vendor: unknown, depth = 0): string | null {
  if (depth > 5 || vendor == null) return null;
  if (typeof vendor === 'string' && /^https?:\/\//i.test(vendor.trim())) {
    return vendor.trim();
  }
  if (typeof vendor !== 'object') return null;
  const o = vendor as Record<string, unknown>;
  for (const key of ['redirectUrl', 'url', 'authorizationUrl', 'authUrl', 'redirect_uri']) {
    const v = o[key];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  for (const v of Object.values(o)) {
    const found = findRedirectUrl(v, depth + 1);
    if (found) return found;
  }
  return null;
}

export function KycHubFlow() {
  const router = useRouter();
  const journey = useJourneyProgressOptional();
  const { session, refresh } = useCustomerSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    journey?.setCompletion01(0.42);
  }, [journey]);

  const loanSelection =
    session?.authenticated === true ? (session.loanSelection ?? null) : null;
  const hasLoanSnapshot = Boolean(
    loanSelection?.amountInr?.trim() ||
      (loanSelection?.tenureDays != null && Number.isFinite(loanSelection.tenureDays)) ||
      loanSelection?.maturityDate?.trim(),
  );

  async function handleDigilocker() {
    setError('');
    setBusy(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const out = await initDigilockerSession(
        origin ? { redirectUrl: `${origin}/kyc/digilocker-callback` } : {},
      );
      if (!out.configured) {
        setError(out.skipReason ?? 'DigiLocker is not configured on the server.');
        return;
      }
      if (!out.ok) {
        setError(
          typeof out.vendor === 'object' && out.vendor && 'message' in (out.vendor as object)
            ? String((out.vendor as { message?: unknown }).message)
            : `DigiLocker request failed (${out.httpStatus ?? 'no status'}).`,
        );
        return;
      }
      await refresh();
      const redirect = out.digilockerLoginUrl ?? findRedirectUrl(out.vendor);
      if (redirect) {
        persistDigilockerSessionTokenForCallback(out.sessionToken);
        window.location.assign(redirect);
        return;
      }
      setError('DigiLocker started, but no login URL was returned. Check with support or use CKYC upload.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start DigiLocker.');
    } finally {
      setBusy(false);
    }
  }

  function handleCkyc() {
    router.push('/kyc/upload-documents');
  }

  function handleBack() {
    if (session?.authenticated) {
      router.replace(getKycHubBackPath(session));
      return;
    }
    router.push('/apply-for-loan');
  }

  const journeyPanel = (
    <div className="h-full flex flex-col gap-5">
      <header>
        <p className="m-0 text-[0.7rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">KYC</p>
        <h1 className="mt-2 mb-2 text-brand-navy text-[clamp(1.75rem,4vw,2.25rem)] font-[900] tracking-[-0.04em] leading-[1.1]">
          Verify your identity
        </h1>
        <p className="m-0 text-brand-muted text-[0.95rem] leading-[1.65]">
          Choose DigiLocker for a quick fetch of KYC data from issued documents, or CKYC to upload documents manually.
        </p>
      </header>

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <div className="grid gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDigilocker()}
          className="group grid gap-2 rounded-[22px] p-4 border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.92)] text-left hover:-translate-y-[1px] transition disabled:opacity-60"
        >
          <strong className="text-brand-navy text-[1.05rem]">Login with DigiLocker</strong>
          <span className="text-brand-muted text-[0.92rem] leading-[1.6]">
            Continue with DigiLocker to pull verified documents where supported.
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={handleCkyc}
          className="group grid gap-2 rounded-[22px] p-4 border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.86)] text-left hover:-translate-y-[1px] transition disabled:opacity-60"
        >
          <strong className="text-brand-navy text-[1.05rem]">CKYC</strong>
          <span className="text-brand-muted text-[0.92rem] leading-[1.6]">
            Upload PAN and Aadhaar (or other proofs) manually for verification.
          </span>
        </button>
      </div>

      <button type="button" className="mc-btn-secondary self-start" onClick={handleBack}>
        Back
      </button>
    </div>
  );

  const leftDescription = hasLoanSnapshot
    ? 'The amount and tenure you selected stay visible while you complete KYC.'
    : 'KYC comes first. You will choose loan amount and tenure on the offer step after identity verification.';

  return (
    <LoanLandingShell
      showSpeedometer={false}
      journeyPanel={journeyPanel}
      leftTitle={
        <>
          Loan <span className="text-[#60a5fa]">details</span>
        </>
      }
      leftDescription={leftDescription}
      leftInfographic={<LoanSummaryLeftRail loanSelection={loanSelection} />}
      mobileStepLabel="KYC"
      mobileOnBack={handleBack}
    />
  );
}
