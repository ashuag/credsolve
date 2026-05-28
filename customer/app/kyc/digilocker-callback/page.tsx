'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
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
  type DownloadAadhaarDigilockerResponse,
} from '@/lib/api/digilocker';
import { getPostDigilockerAadhaarContinuePath } from '@/lib/api/customer-session';

/** Share one in-flight download per token (React Strict Mode runs effects twice). */
const digilockerAadhaarDownloadByToken = new Map<string, Promise<DownloadAadhaarDigilockerResponse>>();

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

function readTokenFromSearchParams(params: URLSearchParams): string {
  return (
    params.get('sessionToken') ??
    params.get('session_token') ??
    params.get('token') ??
    params.get('sessionId') ??
    params.get('session_id') ??
    ''
  ).trim();
}

function DigilockerCallbackContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useCustomerSession();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Fetching your Aadhaar from DigiLocker…');
  const [error, setError] = useState('');
  const [continueHref, setContinueHref] = useState('/kyc');

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
      /* fall through to empty */
    }

    return '';
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.toString()) {
      const cleanPath = pathname ?? '/kyc/digilocker-callback';
      window.history.replaceState(null, '', cleanPath);
      void router.replace(cleanPath, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await refresh();
      if (cancelled) return;

      if (
        session.authenticated === true &&
        session.kycFaceProgress?.digilockerAadhaarCaptured
      ) {
        clearDigilockerSessionTokenFromStorage();
        const href =
          session.lead != null
            ? getPostDigilockerAadhaarContinuePath(session)
            : '/apply-for-loan';
        setContinueHref(href);
        setStatus('done');
        setMessage('Aadhaar details were saved. Continue to the next step.');
        return;
      }

      const token = (await resolveSessionToken()).trim();
      if (cancelled) return;

      if (!token) {
        setStatus('error');
        setError(
          'Missing session token. Open DigiLocker from this app (KYC → Login with DigiLocker) so the session is saved, then try again.',
        );
        return;
      }

      let downloadPromise = digilockerAadhaarDownloadByToken.get(token);
      if (!downloadPromise) {
        downloadPromise = downloadDigilockerAadhaar({ sessionToken: token, consent: true });
        digilockerAadhaarDownloadByToken.set(token, downloadPromise);
        void downloadPromise.finally(() => {
          digilockerAadhaarDownloadByToken.delete(token);
        });
      }

      try {
        const out = await downloadPromise;
        if (cancelled) return;
        if (!out.configured) {
          setStatus('error');
          setError(out.skipReason ?? 'Aadhaar download is not configured on the server.');
          return;
        }
        if (!out.ok) {
          setStatus('error');
          if (out.identityMismatch) {
            setError(
              out.identityMismatchMessage ??
                'Name or date of birth on Aadhaar does not match your loan application. This application cannot proceed.',
            );
            await refresh();
            return;
          }
          const vendorMsg = pickDigilockerDownloadErrorMessage(out.vendor);
          setError(vendorMsg ?? `Aadhaar download failed (HTTP ${out.httpStatus ?? 'n/a'}).`);
          return;
        }
        clearDigilockerSessionTokenFromStorage();
        const next = await refresh();
        if (cancelled) return;
        const href =
          next.authenticated === true && next.lead
            ? getPostDigilockerAadhaarContinuePath(next)
            : '/apply-for-loan';
        setContinueHref(href);
        setStatus('done');
        setMessage('Aadhaar details were saved. Continue to the next step.');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Something went wrong.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh, resolveSessionToken]);

  return (
    <JourneyProgressProvider>
      <div className="mx-auto max-w-lg p-6 grid gap-4">
        <header>
          <p className="m-0 text-[0.7rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">KYC</p>
          <h1 className="mt-2 text-brand-navy text-2xl font-[900] tracking-tight">DigiLocker</h1>
        </header>

        {error ? (
          <>
            <AlertBanner variant="error">{error}</AlertBanner>
            <div className="flex flex-wrap gap-3">
              <Link href="/kyc" className="mc-btn-primary inline-flex justify-center text-center">
                Back to KYC
              </Link>
              <Link
                href="/apply-for-loan"
                className="inline-flex items-center justify-center rounded-xl border border-[rgba(18,36,79,0.18)] px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50/90"
              >
                Apply for a loan
              </Link>
            </div>
          </>
        ) : (
          <>
            {status === 'working' ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/80 p-8">
                <Spinner size={40} />
                <p className="m-0 text-center text-brand-navy font-semibold leading-relaxed">{message}</p>
                <p className="m-0 text-center text-sm text-brand-muted">This usually takes a few seconds.</p>
              </div>
            ) : (
              <div className="grid gap-3 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/90 p-6">
                <p className="m-0 text-sm font-semibold text-emerald-800">DigiLocker complete</p>
                <p className="m-0 text-brand-navy font-semibold leading-relaxed">{message}</p>
                <p className="m-0 text-sm text-brand-muted leading-relaxed">{describeContinueStep(continueHref)}</p>
                <Link href={continueHref} className="mc-btn-primary inline-block text-center">
                  Continue
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </JourneyProgressProvider>
  );
}

export default function DigilockerCallbackPage() {
  return (
    <CustomerJourneyGuard>
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Suspense
          fallback={
            <div className="mx-auto max-w-lg p-6">
              <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/80 p-8">
                <Spinner size={40} />
                <p className="m-0 text-brand-muted text-sm">Loading DigiLocker result…</p>
              </div>
            </div>
          }
        >
          <DigilockerCallbackContent />
        </Suspense>
      </div>
    </CustomerJourneyGuard>
  );
}
