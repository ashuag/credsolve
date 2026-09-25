'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { startDigilockerLoginFlow, fetchPendingDigilockerSession, peekDigilockerExpectSelfie, clearDigilockerExpectSelfie } from '@/lib/api/digilocker';
import { AadhaarOtpFallback } from '@/components/kyc/aadhaar-otp-fallback';
import {
  getCustomerJourneyResumePath,
  getKycHubBackPath,
  isKycHeadMovementPending,
  shouldResumeKycSelfie,
} from '@/lib/api/customer-session';
import { isLoanDocumentsJourneyComplete } from '@/lib/loan-documents-journey';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';
import { KycJourneyShell } from '@/components/kyc/kyc-journey-shell';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m8.5 12 2.4 2.4 4.6-4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KycHubFlow() {
  const router = useRouter();
  const journey = useJourneyProgressOptional();
  const { session, refresh, loading } = useCustomerSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDigilockerFallback, setShowDigilockerFallback] = useState(false);
  const [awaitingDigilockerReturn, setAwaitingDigilockerReturn] = useState(peekDigilockerExpectSelfie);

  const digilockerDone =
    session?.authenticated === true &&
    Boolean(session.kycFaceProgress?.digilockerAadhaarCaptured);
  const livenessPassed =
    session?.authenticated === true && Boolean(session.kycFaceProgress?.livenessPassed);
  const kycCompleted =
    session?.authenticated === true && Boolean(session.journey.kycCompleted);
  /** Liveness can pass while the head-movement clip is still owed — that step lives on /kyc/selfie. */
  const headMovementPending = isKycHeadMovementPending(
    session?.authenticated === true ? session.kycFaceProgress : null,
  );
  const faceStepPending = !livenessPassed || headMovementPending;
  /** Where the journey goes once KYC is done — normally bank details. */
  const nextJourneyPath = getCustomerJourneyResumePath(session);

  const resumeToSelfie = session?.authenticated === true && shouldResumeKycSelfie(session);
  const digilockerFallbackAvailable =
    showDigilockerFallback ||
    (session?.authenticated === true && Boolean(session.kycFaceProgress?.digilockerFallbackAvailable));

  const { progressPct } = useMemo(
    () => kycJourneyProgressFromSession(session),
    [session],
  );

  useEffect(() => {
    journey?.setCompletion01(progressPct / 100);
  }, [journey, progressPct]);

  useEffect(() => {
    if (session?.authenticated === true && session.lead && !isLoanDocumentsJourneyComplete(session)) {
      router.replace('/loan-documents');
    }
  }, [router, session]);

  useEffect(() => {
    if (resumeToSelfie) {
      clearDigilockerExpectSelfie();
      router.replace('/kyc/selfie');
    }
  }, [resumeToSelfie, router]);

  // Local DigiLocker testing: Surepass redirects to a public callback; after you switch
  // back to /kyc, resume Aadhaar download if init left a pending session on the server.
  useEffect(() => {
    if (session?.authenticated !== true) return;
    if (!isLoanDocumentsJourneyComplete(session)) return;
    if (resumeToSelfie) return;

    if (!digilockerFallbackAvailable && !awaitingDigilockerReturn) {
      return;
    }

    if (session.kycFaceProgress?.digilockerAadhaarCaptured) {
      if (awaitingDigilockerReturn) {
        if (!session.journey.kycCompleted) {
          router.replace('/kyc/selfie');
          return;
        }
        clearDigilockerExpectSelfie();
        setAwaitingDigilockerReturn(false);
      }
      return;
    }

    const resumeKey = 'moneycash:digilocker:hub-resume';
    try {
      if (sessionStorage.getItem(resumeKey) === '1' && !awaitingDigilockerReturn) return;
    } catch {
      /* ignore */
    }

    let cancelled = false;
    void (async () => {
      try {
        const pending = await fetchPendingDigilockerSession();
        if (cancelled) return;
        if (pending.sessionToken?.trim()) {
          try {
            sessionStorage.setItem(resumeKey, '1');
          } catch {
            /* ignore */
          }
          router.replace('/kyc/digilocker-callback');
          return;
        }
      } catch {
        /* ignore — user can start DigiLocker after OTP is exhausted */
      }
      if (!cancelled && awaitingDigilockerReturn) {
        clearDigilockerExpectSelfie();
        setAwaitingDigilockerReturn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [awaitingDigilockerReturn, digilockerFallbackAvailable, resumeToSelfie, router, session]);

  async function handleDigilocker() {
    setError('');
    setBusy(true);
    try {
      const result = await startDigilockerLoginFlow('/kyc/digilocker-callback');
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start DigiLocker.');
    } finally {
      setBusy(false);
    }
  }

  function handleBack() {
    if (session?.authenticated) {
      router.replace(getKycHubBackPath(session));
      return;
    }
    router.push('/apply-for-loan');
  }

  if (loading || resumeToSelfie || awaitingDigilockerReturn) {
    return (
      <KycJourneyShell
        mobileStepLabel="KYC"
        mobileOnBack={handleBack}
        journeyPanel={
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <Spinner size={36} />
            <p className="m-0 text-sm font-semibold text-slate-500">Opening the next KYC step…</p>
          </div>
        }
      />
    );
  }

  return (
    <KycJourneyShell
      mobileStepLabel="KYC"
      mobileOnBack={handleBack}
      journeyPanel={
        <section className="flex h-full flex-col" aria-labelledby="kyc-heading">
          {digilockerDone ? (
            <>
              <div className="mb-4">
                <h2
                  id="kyc-heading"
                  className="mb-3 text-xl font-bold leading-[1.1] tracking-tight text-brand-navy md:text-[1.8rem]"
                >
                  DigiLocker <span className="text-brand-blue">verified</span>
                </h2>
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 to-blue-50/50 p-3">
                  <div className="shrink-0 rounded-xl bg-white p-1.5 text-emerald-600 shadow-sm">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="m-0 pt-0.5 text-[0.88rem] leading-relaxed text-slate-600">
                    {!livenessPassed
                      ? 'Aadhaar is verified. Next, take a selfie so we can confirm it is you.'
                      : headMovementPending
                        ? 'Aadhaar is verified. One step left — a short head-movement clip.'
                        : kycCompleted
                          ? 'KYC is complete. Continue to bank details.'
                          : 'Aadhaar is verified. Finish any remaining KYC steps to continue.'}
                  </p>
                </div>
              </div>
              {faceStepPending ? (
                <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-slate-100 bg-white/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm lg:mx-0 lg:px-0">
                  <button type="button" className="mc-btn-primary w-full" onClick={() => router.push('/kyc/selfie')}>
                    {headMovementPending ? 'Continue to head movement' : 'Continue to selfie'}
                  </button>
                </div>
              ) : kycCompleted ? (
                <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-slate-100 bg-white/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm lg:mx-0 lg:px-0">
                  <button type="button" className="mc-btn-primary w-full" onClick={() => router.push(nextJourneyPath)}>
                    {nextJourneyPath === '/bank-details' ? 'Continue to bank details' : 'Continue'}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="mb-4">
                <h2
                  id="kyc-heading"
                  className="mb-3 text-xl font-bold leading-[1.1] tracking-tight text-brand-navy md:text-[1.8rem]"
                >
                  Verify your <span className="text-brand-blue">identity</span>
                </h2>
                <div className="mb-2 flex items-start gap-3 rounded-2xl border border-blue-100/60 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-3">
                  <div className="shrink-0 rounded-xl bg-white p-1.5 text-blue-600 shadow-sm">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <p className="m-0 pt-0.5 text-[0.88rem] leading-relaxed text-slate-600">
                    {digilockerFallbackAvailable
                      ? 'We could not verify Aadhaar with OTP. Continue with DigiLocker — the official government locker for Aadhaar.'
                      : 'Enter your Aadhaar number. An OTP is sent to the mobile number registered with this Aadhaar.'}
                  </p>
                </div>
              </div>

              {digilockerFallbackAvailable ? (
                <>
                  <div className="rounded-[20px] border border-[rgba(20,150,243,0.34)] bg-[rgba(20,150,243,0.08)] px-5 py-4 shadow-[0_0_0_4px_rgba(20,150,243,0.08),0_18px_32px_rgba(23,44,113,0.08)]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(18,36,79,0.08)] bg-white text-brand-blue shadow-[0_8px_18px_rgba(23,44,113,0.08)]">
                        <ShieldIcon />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[1rem] font-extrabold text-brand-navy">DigiLocker</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-brand-blue">
                            Recommended
                          </span>
                        </span>
                        <span className="mt-1 block text-[0.92rem] leading-[1.55] text-brand-muted">
                          Government of India document wallet. Fastest way to finish KYC — no scans or uploads.
                        </span>
                      </span>
                    </div>
                  </div>

                  <p className="mb-2 mt-5 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                    How it works
                  </p>
                  <ol className="m-0 grid list-none gap-3 p-0">
                    {[
                      {
                        n: '1',
                        title: 'Get an Aadhaar OTP',
                        body: 'Sent to the mobile number registered with your Aadhaar.',
                      },
                      {
                        n: '2',
                        title: 'Log in to DigiLocker',
                        body: 'Enter the OTP. No password or paperwork.',
                      },
                      {
                        n: '3',
                        title: 'Tap Allow',
                        body: 'Consent is required so we can fetch Aadhaar and PAN. If you decline, KYC stays incomplete.',
                      },
                    ].map((step) => (
                      <li key={step.n} className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(20,150,243,0.1)] text-[0.8rem] font-extrabold text-brand-blue">
                          {step.n}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[0.95rem] font-extrabold text-brand-navy">{step.title}</span>
                          <span className="mt-0.5 block text-[0.86rem] leading-relaxed text-slate-500">{step.body}</span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  {error ? (
                    <div className="mt-4">
                      <AlertBanner variant="error">{error}</AlertBanner>
                    </div>
                  ) : null}

                  <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-slate-100 bg-white/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm lg:mx-0 lg:px-0">
                    <button
                      type="button"
                      id="go"
                      className="mc-btn-primary w-full"
                      disabled={busy}
                      onClick={() => void handleDigilocker()}
                    >
                      {busy ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Spinner size={18} /> Connecting…
                        </span>
                      ) : (
                        'Continue with DigiLocker'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-1">
                  <AadhaarOtpFallback
                    onVerified={(href) => router.replace(href)}
                    onDigilockerFallback={() => setShowDigilockerFallback(true)}
                  />
                </div>
              )}
            </>
          )}
        </section>
      }
    />
  );
}
