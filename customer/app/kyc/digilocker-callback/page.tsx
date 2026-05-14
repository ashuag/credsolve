'use client';

import Link from 'next/link';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Spinner } from '@/components/ui/spinner';
import {
  clearDigilockerSessionTokenFromStorage,
  downloadDigilockerAadhaar,
  persistDigilockerSessionTokenForCallback,
  pickDigilockerDownloadErrorMessage,
  readDigilockerSessionTokenFromStorage,
} from '@/lib/api/digilocker';
import { getPostDigilockerAadhaarContinuePath } from '@/lib/api/customer-session';

/** Avoid duplicate POST /download-aadhaar when layout + search updates retrigger effects (e.g. React Strict Mode). */
const digilockerAadhaarDownloadStarted = new Set<string>();

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

function DigilockerCallbackContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Fetching your Aadhaar from DigiLocker…');
  const [error, setError] = useState('');
  const [continueHref, setContinueHref] = useState('/kyc');
  const resolvedTokenRef = useRef<string | null>(null);

  /**
   * Persist session token from the callback query (if any), resolve the token for download,
   * then strip query params from the address bar before paint (name/DOB/etc. from DigiLocker).
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;

    const rawSearch = window.location.search;
    let token = readDigilockerSessionTokenFromStorage().trim();

    if (rawSearch) {
      const params = new URLSearchParams(rawSearch);
      const fromQuery = (
        params.get('sessionToken') ??
        params.get('session_token') ??
        params.get('token') ??
        ''
      ).trim();
      if (fromQuery) {
        persistDigilockerSessionTokenForCallback(fromQuery);
        token = fromQuery;
      }
      window.history.replaceState(null, '', pathname);
      void router.replace(pathname, { scroll: false });
    }

    resolvedTokenRef.current = token.trim() || readDigilockerSessionTokenFromStorage().trim();
  }, [pathname, router]);

  useEffect(() => {
    const token = (resolvedTokenRef.current ?? readDigilockerSessionTokenFromStorage()).trim();
    if (!token) {
      setStatus('error');
      setError(
        'Missing session token. Open DigiLocker from this app (KYC) so the session is saved, then try again.',
      );
      return;
    }

    if (digilockerAadhaarDownloadStarted.has(token)) {
      return;
    }
    digilockerAadhaarDownloadStarted.add(token);

    let cancelled = false;
    (async () => {
      try {
        const out = await downloadDigilockerAadhaar({ sessionToken: token.trim(), consent: true });
        if (cancelled) return;
        if (!out.configured) {
          digilockerAadhaarDownloadStarted.delete(token);
          setStatus('error');
          setError(out.skipReason ?? 'Aadhaar download is not configured on the server.');
          return;
        }
        if (!out.ok) {
          digilockerAadhaarDownloadStarted.delete(token);
          setStatus('error');
          const vendorMsg = pickDigilockerDownloadErrorMessage(out.vendor);
          setError(vendorMsg ?? `Aadhaar download failed (HTTP ${out.httpStatus ?? 'n/a'}).`);
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
        setMessage('Aadhaar details were saved. Continue to the next step.');
      } catch (e) {
        digilockerAadhaarDownloadStarted.delete(token);
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Something went wrong.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <JourneyProgressProvider>
      <div className="mx-auto max-w-lg p-6 grid gap-4">
        <header>
          <p className="m-0 text-[0.7rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">KYC</p>
          <h1 className="mt-2 text-brand-navy text-2xl font-[900] tracking-tight">DigiLocker</h1>
          <p className="m-0 text-brand-muted text-[0.95rem] leading-relaxed">
            We finish the DigiLocker hand-off here and store your Aadhaar data for this application.
          </p>
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
