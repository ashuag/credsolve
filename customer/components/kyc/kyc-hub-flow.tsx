'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { startDigilockerLoginFlow } from '@/lib/api/digilocker';
import { getKycHubBackPath } from '@/lib/api/customer-session';
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
          <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>Verify your identity</h1>
          <p className={`${styles.lede} ${styles.reveal} ${styles.d2}`}>
            We use <strong>DigiLocker</strong> to securely fetch your government-issued documents — no uploads, no
            waiting. Here&apos;s exactly what to expect.
          </p>

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
                <h4>Allow Aadhaar access</h4>
                <p>
                  On the consent screen, you <span className={styles.hl}>must tap &ldquo;Allow&rdquo;</span> to let
                  DigiLocker share your Aadhaar with us.
                </p>
              </div>
            </div>
          </div>

          <div className={`${styles.notice} ${styles.reveal} ${styles.d5}`}>
            <span className={styles.noticeIc}>!</span>
            <div>
              <h5>Consent is required to finish KYC</h5>
              <p>
                If you decline the permission on the DigiLocker screen, we can&apos;t fetch your Aadhaar — and your KYC
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

          <p className={`${styles.alt} ${styles.reveal} ${styles.d6}`}>
            Don&apos;t have DigiLocker set up?{' '}
            <Link href="/kyc/upload-documents">Upload documents manually (CKYC)</Link>
          </p>

          <div className={`${styles.back} ${styles.reveal} ${styles.d6}`}>
            <button type="button" className={styles.backBtn} onClick={handleBack}>
              <ArrowLeftIcon />
              Back
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
