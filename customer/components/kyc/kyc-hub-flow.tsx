'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { startDigilockerLoginFlow, fetchPendingDigilockerSession } from '@/lib/api/digilocker';
import {
  getCustomerJourneyResumePath,
  getKycHubBackPath,
  isKycHeadMovementPending,
  shouldResumeKycSelfie,
} from '@/lib/api/customer-session';
import { isLoanDocumentsJourneyComplete } from '@/lib/loan-documents-journey';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';
import { KycJourneyLeftPanel } from '@/components/kyc/kyc-journey-left-panel';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import styles from './kyc-hub-flow.module.css';

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-4Z"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m8.5 12 2.4 2.4 4.6-4.8"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KycHubFlow() {
  const router = useRouter();
  const journey = useJourneyProgressOptional();
  const { session, refresh } = useCustomerSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loanSelection = session?.authenticated === true ? session.loanSelection : null;
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

  const { progressPct, activeStepIndex } = useMemo(
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
    if (session?.authenticated === true && shouldResumeKycSelfie(session)) {
      router.replace('/kyc/selfie');
    }
  }, [router, session]);

  // Local DigiLocker testing: Surepass redirects to a public callback; after you switch
  // back to /kyc, resume Aadhaar download if init left a pending session on the server.
  useEffect(() => {
    if (session?.authenticated !== true) return;
    if (session.kycFaceProgress?.digilockerAadhaarCaptured) return;
    if (!isLoanDocumentsJourneyComplete(session)) return;

    const resumeKey = 'moneycash:digilocker:hub-resume';
    try {
      if (sessionStorage.getItem(resumeKey) === '1') return;
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
        }
      } catch {
        /* ignore — user can start DigiLocker manually */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, session]);

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

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <KycJourneyLeftPanel
          loanSelection={loanSelection}
          progressPct={progressPct}
          activeStepIndex={activeStepIndex}
        />

        <section className={styles.right}>
          <div className={`${styles.reveal} ${styles.d1}`}>
            <span className={styles.eyebrow}>KYC</span>
          </div>
          <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>
            {digilockerDone ? 'DigiLocker verified' : 'Verify your identity'}
          </h1>

          {digilockerDone ? (
            <div className={`${styles.reveal} ${styles.d2} grid gap-3 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/90 p-6`}>
              <p className="m-0 text-sm font-semibold text-emerald-800">Aadhaar verified via DigiLocker</p>
              <p className="m-0 text-sm text-brand-muted leading-relaxed">
                {!livenessPassed
                  ? 'Identity capture from DigiLocker is complete. Next, verify with a selfie and liveness check.'
                  : headMovementPending
                    ? 'Identity capture from DigiLocker is complete. One step left — record a short head-movement clip to confirm you are live.'
                    : kycCompleted
                      ? 'KYC is complete. You can continue to bank details.'
                      : 'Identity capture from DigiLocker is complete. Finish any remaining KYC steps to continue.'}
              </p>
              {faceStepPending ? (
                <button
                  type="button"
                  className={styles.cta}
                  onClick={() => router.push('/kyc/selfie')}
                >
                  {headMovementPending
                    ? 'Continue to head movement check'
                    : 'Continue to selfie & liveness'}
                  <ArrowRightIcon />
                </button>
              ) : kycCompleted ? (
                <button
                  type="button"
                  className={styles.cta}
                  onClick={() => router.push(nextJourneyPath)}
                >
                  {nextJourneyPath === '/bank-details' ? 'Continue to bank details' : 'Continue'}
                  <ArrowRightIcon />
                </button>
              ) : null}
            </div>
          ) : (
            <>
          <button
            type="button"
            className={`${styles.method} ${styles.reveal} ${styles.d2}`}
            disabled={busy}
            onClick={() => void handleDigilocker()}
          >
            <div className={styles.methodTop}>
              <span className={styles.dlIcon}>
                <ShieldIcon />
              </span>
              <h3 className={styles.methodTitle}>Login with DigiLocker</h3>
              <span className={styles.badge}>Recommended</span>
            </div>
            <p className={styles.methodDesc}>
              Government of India&apos;s secure document wallet. Verified instantly from your Aadhaar — the fastest way
              to finish KYC.
            </p>
          </button>

          <p className={`${styles.howTitle} ${styles.reveal} ${styles.d3}`}>How it works</p>
          <div className={styles.flow}>
            <div className={`${styles.flowStep} ${styles.reveal} ${styles.d3}`}>
              <span className={styles.flowNum}>1</span>
              <div className={styles.flowBody}>
                <h4>Get an Aadhaar OTP</h4>
                <p>
                  An OTP is sent to the <span className={styles.hl}>mobile number registered with your Aadhaar</span>.
                  Keep that phone handy.
                </p>
              </div>
            </div>
            <div className={`${styles.flowStep} ${styles.reveal} ${styles.d4}`}>
              <span className={styles.flowNum}>2</span>
              <div className={styles.flowBody}>
                <h4>Log in to DigiLocker</h4>
                <p>Enter the OTP to sign in securely. No passwords or paperwork needed.</p>
              </div>
            </div>
            <div className={`${styles.flowStep} ${styles.reveal} ${styles.d5}`}>
              <span className={styles.flowNum}>3</span>
              <div className={styles.flowBody}>
                <h4>Allow Aadhaar and Pan access</h4>
                <p>
                  On the consent screen, you <span className={styles.hl}>must tap &ldquo;Allow&rdquo;</span> to let
                  DigiLocker share your Aadhaar and Pan with us.
                </p>
              </div>
            </div>
          </div>

          <div className={`${styles.notice} ${styles.reveal} ${styles.d5}`}>
            <span className={styles.noticeIc}>!</span>
            <div>
              <h5>Consent is required to finish KYC</h5>
              <p>
                If you decline the permission on the DigiLocker screen, we can&apos;t fetch your Aadhaar and Pan — and your KYC
                will stay <strong>incomplete</strong>. Please tap &ldquo;Allow&rdquo; when prompted.
              </p>
            </div>
          </div>

          {error ? (
            <div className={styles.errorBanner}>
              <AlertBanner variant="error">{error}</AlertBanner>
            </div>
          ) : null}

          <button
            type="button"
            id="go"
            className={`${styles.cta} ${styles.reveal} ${styles.d6}`}
            disabled={busy}
            onClick={() => void handleDigilocker()}
          >
            {busy ? (
              <>
                <Spinner size={18} />
                Connecting to DigiLocker…
              </>
            ) : (
              <>
                Continue with DigiLocker
                <ArrowRightIcon />
              </>
            )}
          </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
