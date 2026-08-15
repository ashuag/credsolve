'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { KycJourneyShell } from '@/components/kyc/kyc-journey-shell';
import styles from '@/components/kyc/kyc-hub-flow.module.css';
import { JourneyProgressProvider, useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import {
  clearDigilockerExpectSelfie,
  clearDigilockerSessionTokenFromStorage,
  downloadDigilockerAadhaar,
  fetchPendingDigilockerSession,
  markDigilockerExpectSelfie,
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
    return 'Continue to take a selfie.';
  }
  if (href.startsWith('/kyc')) {
    return 'Continue to complete your KYC.';
  }
  if (href === '/apply-for-loan') {
    return 'Start or resume your loan application from the apply page.';
  }
  if (href.startsWith('/loan-selection') || href.startsWith('/pre-approved')) {
    return 'Continue setting up your loan.';
  }
  return 'Continue to the next step in your application.';
}

function readTokenFromSearchParams(params: URLSearchParams | ReadonlyURLSearchParams | null): string {
  if (!params) return '';
  return (
    params.get('sessionToken') ??
    params.get('session_token') ??
    params.get('client_id') ??
    params.get('clientId') ??
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
  children: ReactNode;
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
  const journey = useJourneyProgressOptional();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Fetching your Aadhaar from DigiLocker…');
  const [error, setError] = useState('');
  const [failureKind, setFailureKind] = useState<DownloadFailureKind | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [attemptsAllowed, setAttemptsAllowed] = useState(DEFAULT_MAX_ATTEMPTS);
  const [retryBusy, setRetryBusy] = useState(false);
  const [continueHref, setContinueHref] = useState('/kyc/selfie');
  const sessionTokenRef = useRef('');
  const runDownloadRef = useRef<() => Promise<void>>(async () => {});
  const refreshRef = useRef(refresh);
  const resolveSessionTokenRef = useRef<() => Promise<string>>(async () => '');

  // Persist OAuth return token before the URL cleanup effect strips query params.
  if (typeof window !== 'undefined') {
    const fromQuery = readTokenFromSearchParams(searchParams);
    if (fromQuery) {
      persistDigilockerSessionTokenForCallback(fromQuery);
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = fromQuery;
      }
    }
  }

  const { progressPct } = useMemo(
    () => kycJourneyProgressFromSession(session),
    [session],
  );

  useEffect(() => {
    journey?.setCompletion01(progressPct / 100);
  }, [journey, progressPct]);

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

    // Token may be empty: backend recovers the DigiLocker client_id / session from Redis
    // (saved at init). That lets local resume after Surepass redirects to a public callback.
    const token = sessionTokenRef.current.trim();

    try {
      const out = await downloadDigilockerAadhaar(
        token ? { sessionToken: token, consent: true } : { consent: true },
      );
      const { used, allowed } = applyAttemptCounts(
        out,
        session?.authenticated === true ? session.kycFaceProgress?.digilockerAadhaarDownloadAttempts : undefined,
        session?.authenticated === true
          ? session.kycFaceProgress?.digilockerAadhaarDownloadMaxAttempts
          : undefined,
      );

      if (!out.configured) {
        clearDigilockerExpectSelfie();
        setStatus('error');
        setFailureKind('not_configured');
        setError(downloadErrorMessage(out));
        return;
      }

      if (!out.ok) {
        clearDigilockerExpectSelfie();
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
      markDigilockerExpectSelfie();
      const next = await refresh();
      const href =
        next.authenticated === true && next.lead
          ? getPostDigilockerAadhaarContinuePath(next)
          : '/kyc/selfie';
      setContinueHref(href);
      setMessage('Aadhaar verified. Opening selfie…');
      router.replace(href);
    } catch (e) {
      clearDigilockerExpectSelfie();
      setStatus('error');
      setFailureKind('retryable');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [applyAttemptCounts, handleTerminalFailure, refresh, router, session]);

  runDownloadRef.current = runDownload;
  refreshRef.current = refresh;
  resolveSessionTokenRef.current = resolveSessionToken;

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
    if (!searchParams?.toString()) return;
    if (pathname !== '/kyc/digilocker-callback') return;
    window.history.replaceState(null, '', '/kyc/digilocker-callback');
    void router.replace('/kyc/digilocker-callback', { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const currentSession = await refreshRef.current();
      if (cancelled) return;

      const kyc = currentSession.authenticated === true ? currentSession.kycFaceProgress : null;
      const maxAttempts = kyc?.digilockerAadhaarDownloadMaxAttempts ?? DEFAULT_MAX_ATTEMPTS;
      const priorAttempts = kyc?.digilockerAadhaarDownloadAttempts ?? 0;
      setAttemptsAllowed(maxAttempts);
      setAttemptsUsed(priorAttempts);

      if (currentSession.authenticated === true && kyc?.digilockerAadhaarCaptured) {
        clearDigilockerSessionTokenFromStorage();
        markDigilockerExpectSelfie();
        const href =
          currentSession.lead != null
            ? getPostDigilockerAadhaarContinuePath(currentSession)
            : '/kyc/selfie';
        setContinueHref(href);
        setMessage('Aadhaar verified. Opening selfie…');
        router.replace(href);
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
        clearDigilockerExpectSelfie();
        setStatus('error');
        setFailureKind('retryable');
        setError('Maximum download attempts reached.');
        return;
      }

      const token = (await resolveSessionTokenRef.current()).trim();
      if (cancelled) return;

      sessionTokenRef.current = token;
      // Even without a browser token, try download — local backend Redis still has
      // the client_id from init after you manually switch back from the public callback.
      if (!token) {
        setMessage('Resuming DigiLocker from your saved session…');
      }

      await runDownloadRef.current();
    })();

    return () => {
      cancelled = true;
    };
    // Run once on mount; callbacks are read from refs so session updates don't cancel the flow.
  }, [router]);

  const attemptsRemaining = Math.max(0, attemptsAllowed - attemptsUsed);
  const canRetry =
    status === 'error' &&
    failureKind === 'retryable' &&
    attemptsRemaining > 0 &&
    !retryBusy;

  return (
    <KycJourneyShell
      mobileStepLabel="KYC"
      mobileOnBack={() => router.push('/kyc')}
      journeyPanel={
        <div
          className={
            status === 'working' || status === 'error' ? 'flex min-h-[40vh] flex-col justify-center' : undefined
          }
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
            ) : null}
        </div>
      }
    />
  );
}

export default function DigilockerCallbackPage() {
  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <Suspense
          fallback={
            <KycJourneyShell
              mobileStepLabel="KYC"
              journeyPanel={
                <div className="flex min-h-[40vh] w-full items-center justify-center">
                  <Spinner size={40} />
                </div>
              }
            />
          }
        >
          <DigilockerCallbackContent />
        </Suspense>
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
