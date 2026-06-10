'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { KycJourneyLeftPanel } from '@/components/kyc/kyc-journey-left-panel';
import styles from '@/components/kyc/kyc-hub-flow.module.css';
import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import {
  clearDigilockerSessionTokenFromStorage,
  downloadDigilockerAadhaar,
  fetchPendingDigilockerSession,
  persistDigilockerSessionTokenForCallback,
  pickDigilockerDownloadErrorMessage,
  readDigilockerSessionTokenFromStorage,
  startDigilockerLoginFlow,
  type DownloadAadhaarDigilockerResponse,
} from '@/lib/api/digilocker';
import {
  getPostDigilockerAadhaarContinuePath,
  isLeadRejectedAndLocked,
} from '@/lib/api/customer-session';
import { kycJourneyProgressFromSession } from '@/lib/kyc-journey-progress';

const DEFAULT_MAX_ATTEMPTS = 3;

type DownloadFailureKind = 'retryable' | 'identity_mismatch' | 'missing_token' | 'not_configured';

function describeContinueStep(href: string): string {
  if (href.startsWith('/kyc/selfie')) {
    return 'Next: save a selfie and complete face verification for this application.';
  }
  if (href.startsWith('/kyc')) {
    return 'Return to the KYC hub to pick up where you left off.';
  }
  if (href === '/apply-for-loan') {
    return 'Start or resume your loan application from the apply page.';
  }
  if (href.startsWith('/loan-selection') || href.startsWith('/pre-approved')) {
    return 'Continue setting up your loan.';
  }
  return 'Continue your application.';
}

function readTokenFromSearchParams(params: URLSearchParams | ReadonlyURLSearchParams | null): string {
  if (!params) return '';
  return (
    params.get('sessionToken') ??
    params.get('session_token') ??
    params.get('token') ??
    params.get('sessionId') ??
    params.get('session_id') ??
    ''
  ).trim();
}

function classifyDownloadFailure(out: DownloadAadhaarDigilockerResponse): DownloadFailureKind {
  if (!out.configured) return 'not_configured';
  if (out.identityMismatch) return 'identity_mismatch';
  if (!out.ok) return 'retryable';
  return 'retryable';
}

function downloadErrorMessage(out: DownloadAadhaarDigilockerResponse): string {
  if (out.identityMismatch) {
    return (
      out.identityMismatchMessage ??
      'Name or date of birth on Aadhaar does not match your loan application. This application cannot proceed.'
    );
  }
  if (!out.configured) {
    return out.skipReason ?? 'Aadhaar download is not configured on the server.';
  }
  const vendorMsg = pickDigilockerDownloadErrorMessage(out.vendor);
  return vendorMsg ?? `Aadhaar download failed (HTTP ${out.httpStatus ?? 'n/a'}).`;
}

function retryGuidanceMessage(attemptsRemaining: number): string {
  if (attemptsRemaining <= 0) {
    return 'Maximum download attempts reached. We could not complete your KYC.';
  }
  if (attemptsRemaining === 1) {
    return 'KYC failed. You can retry one more time — make sure in DigiLocker you give permission to download Aadhaar.';
  }
  return `KYC failed. You have ${attemptsRemaining} attempts left — make sure in DigiLocker you give permission to download Aadhaar.`;
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorCircleIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CallbackStatusCard({
  variant = 'default',
  children,
}: {
  variant?: 'default' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.callbackCard} ${styles.reveal} ${styles.d2} ${
        variant === 'error' ? styles.callbackCardError : ''
      }`}
    >
      {children}
    </div>
  );
}

function DigilockerCallbackContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, refresh } = useCustomerSession();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Fetching your Aadhaar from DigiLocker…');
  const [error, setError] = useState('');
  const [failureKind, setFailureKind] = useState<DownloadFailureKind | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [attemptsAllowed, setAttemptsAllowed] = useState(DEFAULT_MAX_ATTEMPTS);
  const [retryBusy, setRetryBusy] = useState(false);
  const [continueHref, setContinueHref] = useState('/kyc');
  const sessionTokenRef = useRef('');
  const autoRunStartedRef = useRef(false);

  const loanSelection = session?.authenticated === true ? session.loanSelection : null;
  const { progressPct, activeStepIndex } = useMemo(
    () => kycJourneyProgressFromSession(session),
    [session],
  );

  const resolveSessionToken = useCallback(async (): Promise<string> => {
    const fromQuery = readTokenFromSearchParams(searchParams);
    if (fromQuery) {
      persistDigilockerSessionTokenForCallback(fromQuery);
      return fromQuery;
    }

    const stored = readDigilockerSessionTokenFromStorage();
    if (stored) return stored;

    try {
      const pending = await fetchPendingDigilockerSession();
      const fromServer = pending.sessionToken?.trim() ?? '';
      if (fromServer) {
        persistDigilockerSessionTokenForCallback(fromServer);
        return fromServer;
      }
    } catch {
      /* fall through */
    }

    return '';
  }, [searchParams]);

  const applyAttemptCounts = useCallback(
    (out: DownloadAadhaarDigilockerResponse, sessionAttempts?: number, sessionMax?: number) => {
      const used = out.attemptsUsed ?? sessionAttempts ?? attemptsUsed;
      const allowed = out.attemptsAllowed ?? sessionMax ?? attemptsAllowed;
      setAttemptsUsed(used);
      setAttemptsAllowed(allowed);
      return { used, allowed };
    },
    [attemptsAllowed, attemptsUsed],
  );

  const handleTerminalFailure = useCallback(
    async (out: DownloadAadhaarDigilockerResponse) => {
      applyAttemptCounts(out);
      const next = await refresh();
      if (
        next.authenticated === true &&
        next.lead &&
        (out.terminalFailure || isLeadRejectedAndLocked(next.lead))
      ) {
        router.replace('/thank-you-interest');
        return true;
      }
      return false;
    },
    [applyAttemptCounts, refresh, router],
  );

  const runDownload = useCallback(async () => {
    setStatus('working');
    setError('');
    setFailureKind(null);
    setMessage('Fetching your Aadhaar from DigiLocker…');

    const token = sessionTokenRef.current.trim();
    if (!token) {
      setStatus('error');
      setFailureKind('missing_token');
      setError(
        'Missing session token. Open DigiLocker from this app (KYC → Login with DigiLocker) so the session is saved, then try again.',
      );
      return;
    }

    try {
      const out = await downloadDigilockerAadhaar({ sessionToken: token, consent: true });
      const { used, allowed } = applyAttemptCounts(
        out,
        session?.authenticated === true ? session.kycFaceProgress?.digilockerAadhaarDownloadAttempts : undefined,
        session?.authenticated === true
          ? session.kycFaceProgress?.digilockerAadhaarDownloadMaxAttempts
          : undefined,
      );

      if (!out.configured) {
        setStatus('error');
        setFailureKind('not_configured');
        setError(downloadErrorMessage(out));
        return;
      }

      if (!out.ok) {
        if (out.identityMismatch) {
          const redirected = await handleTerminalFailure(out);
          if (redirected) return;
          setStatus('error');
          setFailureKind('identity_mismatch');
          setError(downloadErrorMessage(out));
          return;
        }

        if (out.terminalFailure || used >= allowed) {
          const redirected = await handleTerminalFailure(out);
          if (redirected) return;
        }

        setStatus('error');
        setFailureKind(classifyDownloadFailure(out));
        setError(downloadErrorMessage(out));
        return;
      }

      clearDigilockerSessionTokenFromStorage();
      const next = await refresh();
      const href =
        next.authenticated === true && next.lead
          ? getPostDigilockerAadhaarContinuePath(next)
          : '/apply-for-loan';
      setContinueHref(href);
      setStatus('done');
      setMessage(
        next.authenticated === true && next.journey.kycCompleted
          ? 'KYC completed. Your Aadhaar details were verified and saved.'
          : 'Aadhaar details were saved. Continue to the next step.',
      );
    } catch (e) {
      setStatus('error');
      setFailureKind('retryable');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [applyAttemptCounts, handleTerminalFailure, refresh, session]);

  const handleRetryDigilocker = useCallback(async () => {
    setRetryBusy(true);
    setError('');
    try {
      const result = await startDigilockerLoginFlow('/kyc/digilocker-callback');
      if (!result.ok) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to restart DigiLocker.');
    } finally {
      setRetryBusy(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams?.toString()) {
      const cleanPath = pathname ?? '/kyc/digilocker-callback';
      window.history.replaceState(null, '', cleanPath);
      void router.replace(cleanPath, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (autoRunStartedRef.current) return;
    autoRunStartedRef.current = true;

    let cancelled = false;

    void (async () => {
      const currentSession = await refresh();
      if (cancelled) return;

      const kyc = currentSession.authenticated === true ? currentSession.kycFaceProgress : null;
      const maxAttempts = kyc?.digilockerAadhaarDownloadMaxAttempts ?? DEFAULT_MAX_ATTEMPTS;
      const priorAttempts = kyc?.digilockerAadhaarDownloadAttempts ?? 0;
      setAttemptsAllowed(maxAttempts);
      setAttemptsUsed(priorAttempts);

      if (currentSession.authenticated === true && kyc?.digilockerAadhaarCaptured) {
        clearDigilockerSessionTokenFromStorage();
        const href =
          currentSession.lead != null
            ? getPostDigilockerAadhaarContinuePath(currentSession)
            : '/apply-for-loan';
        setContinueHref(href);
        setStatus('done');
        setMessage(
          currentSession.journey.kycCompleted
            ? 'KYC completed. Your Aadhaar details were verified and saved.'
            : 'Aadhaar details were saved. Continue to the next step.',
        );
        return;
      }

      if (
        currentSession.authenticated === true &&
        currentSession.lead &&
        isLeadRejectedAndLocked(currentSession.lead)
      ) {
        router.replace('/thank-you-interest');
        return;
      }

      if (priorAttempts >= maxAttempts) {
        setStatus('error');
        setFailureKind('retryable');
        setError('Maximum download attempts reached.');
        return;
      }

      const token = (await resolveSessionToken()).trim();
      if (cancelled) return;

      sessionTokenRef.current = token;
      if (!token) {
        setStatus('error');
        setFailureKind('missing_token');
        setError(
          'Missing session token. Open DigiLocker from this app (KYC → Login with DigiLocker) so the session is saved, then try again.',
        );
        return;
      }

      await runDownload();
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh, resolveSessionToken, runDownload, router]);

  const attemptsRemaining = Math.max(0, attemptsAllowed - attemptsUsed);
  const canRetry =
    status === 'error' &&
    failureKind === 'retryable' &&
    attemptsRemaining > 0 &&
    !retryBusy;

  return (
    <JourneyProgressProvider>
      <div className={styles.page}>
        <div className={styles.shell}>
          <KycJourneyLeftPanel
            loanSelection={loanSelection}
            progressPct={progressPct}
            activeStepIndex={activeStepIndex}
          />

          <section
            className={`${styles.right} ${
              status === 'working' || status === 'error' ? styles.rightCentered : ''
            }`}
          >
            {status === 'working' ? (
              <CallbackStatusCard>
                <Spinner size={40} />
                <p className={styles.callbackCardTitle}>{message}</p>
                <p className={styles.callbackCardSub}>This usually takes a few seconds.</p>
              </CallbackStatusCard>
            ) : status === 'error' ? (
              <CallbackStatusCard variant="error">
                <span className={styles.callbackErrorIcon} aria-hidden>
                  <ErrorCircleIcon />
                </span>
                <p className={styles.callbackCardTitle}>
                  {failureKind === 'identity_mismatch'
                    ? 'Aadhaar details do not match'
                    : 'Aadhaar download failed'}
                </p>
                <p className={styles.callbackCardSub}>
                  {error ||
                    (failureKind === 'retryable' && attemptsRemaining > 0
                      ? retryGuidanceMessage(attemptsRemaining)
                      : 'We could not fetch your Aadhaar from DigiLocker.')}
                </p>
                {failureKind === 'retryable' && attemptsRemaining > 0 ? (
                  <p className={styles.callbackCardSub}>
                    On the DigiLocker consent screen, tap <strong>Allow</strong> so we can download your Aadhaar.
                  </p>
                ) : null}
                <div className={styles.callbackCardActions}>
                  {canRetry || failureKind === 'missing_token' ? (
                    <button
                      type="button"
                      className={styles.cta}
                      disabled={retryBusy}
                      onClick={() => void handleRetryDigilocker()}
                    >
                      {retryBusy ? (
                        <>
                          <Spinner size={18} />
                          Opening DigiLocker…
                        </>
                      ) : (
                        <>
                          {failureKind === 'missing_token' ? 'Open DigiLocker' : 'Try again with DigiLocker'}
                          <ArrowRightIcon />
                        </>
                      )}
                    </button>
                  ) : null}
                  <Link href="/kyc" className={styles.callbackCardLink}>
                    Back to KYC
                  </Link>
                </div>
              </CallbackStatusCard>
            ) : status === 'done' ? (
              <>
                <span className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>KYC</span>
                <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>DigiLocker complete</h1>
                <div className={`${styles.reveal} ${styles.d2} grid gap-3 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/90 p-6 mt-6`}>
                  <p className="m-0 text-sm font-semibold text-emerald-800">Aadhaar verified</p>
                  <p className="m-0 text-brand-navy font-semibold leading-relaxed">{message}</p>
                  <p className="m-0 text-sm text-brand-muted leading-relaxed">{describeContinueStep(continueHref)}</p>
                  <Link href={continueHref} className={`${styles.cta} no-underline`}>
                    Continue
                    <ArrowRightIcon />
                  </Link>
                </div>
              </>
            ) : failureKind === 'retryable' && canRetry ? (
              <>
                <span className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>KYC</span>
                <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>DigiLocker</h1>
                <p className={`${styles.lede} ${styles.reveal} ${styles.d2}`}>{retryGuidanceMessage(attemptsRemaining)}</p>

                <div className={`${styles.notice} ${styles.reveal} ${styles.d3}`}>
                  <span className={styles.noticeIc}>!</span>
                  <div>
                    <h5>Allow Aadhaar download in DigiLocker</h5>
                    <p>
                      On the DigiLocker consent screen, you <strong>must tap &ldquo;Allow&rdquo;</strong> so we can
                      download your Aadhaar. If permission is denied, KYC cannot be completed.
                    </p>
                  </div>
                </div>

                {error ? (
                  <div className={`${styles.errorBanner} ${styles.reveal} ${styles.d3}`}>
                    <AlertBanner variant="error">{error}</AlertBanner>
                  </div>
                ) : null}

                <button
                  type="button"
                  className={`${styles.cta} ${styles.reveal} ${styles.d4}`}
                  disabled={retryBusy}
                  onClick={() => void handleRetryDigilocker()}
                >
                  {retryBusy ? (
                    <>
                      <Spinner size={18} />
                      Opening DigiLocker…
                    </>
                  ) : (
                    <>
                      Try again with DigiLocker
                      <ArrowRightIcon />
                    </>
                  )}
                </button>

                <div className={`${styles.back} ${styles.reveal} ${styles.d5}`}>
                  <Link href="/kyc" className={styles.backBtn}>
                    <ArrowLeftIcon />
                    Back to KYC
                  </Link>
                </div>
              </>
            ) : (
              <>
                <span className={`${styles.eyebrow} ${styles.reveal} ${styles.d1}`}>KYC</span>
                <h1 className={`${styles.rightTitle} ${styles.reveal} ${styles.d1}`}>DigiLocker</h1>
                <div className={`${styles.errorBanner} ${styles.reveal} ${styles.d2}`}>
                  <AlertBanner variant="error">{error}</AlertBanner>
                </div>
                {failureKind === 'retryable' && attemptsRemaining <= 0 ? (
                  <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
                    Maximum download attempts reached. We could not complete your KYC.
                  </p>
                ) : null}
                <div className={`${styles.back} ${styles.reveal} ${styles.d4}`}>
                  {failureKind === 'missing_token' ? (
                    <button
                      type="button"
                      className={`${styles.cta} ${styles.reveal}`}
                      disabled={retryBusy}
                      onClick={() => void handleRetryDigilocker()}
                    >
                      {retryBusy ? (
                        <>
                          <Spinner size={18} />
                          Opening DigiLocker…
                        </>
                      ) : (
                        <>
                          Open DigiLocker
                          <ArrowRightIcon />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link href="/kyc" className={styles.backBtn}>
                      <ArrowLeftIcon />
                      Back to KYC
                    </Link>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </JourneyProgressProvider>
  );
}

export default function DigilockerCallbackPage() {
  return (
    <CustomerJourneyGuard>
      <Suspense
        fallback={
          <div className={styles.page}>
            <div className="flex min-h-[40vh] w-full items-center justify-center">
              <Spinner size={40} />
            </div>
          </div>
        }
      >
        <DigilockerCallbackContent />
      </Suspense>
    </CustomerJourneyGuard>
  );
}
