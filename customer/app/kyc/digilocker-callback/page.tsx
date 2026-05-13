'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import {
  clearDigilockerSessionTokenFromStorage,
  downloadDigilockerAadhaar,
  readDigilockerSessionTokenFromStorage,
} from '@/lib/api/digilocker';
import { getPostDigilockerAadhaarContinuePath } from '@/lib/api/customer-session';

function DigilockerCallbackContent() {
  const searchParams = useSearchParams();
  const { refresh } = useCustomerSession();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Finishing DigiLocker and fetching Aadhaar…');
  const [error, setError] = useState('');
  const [continueHref, setContinueHref] = useState('/kyc');

  useEffect(() => {
    const fromQuery =
      searchParams.get('sessionToken') ??
      searchParams.get('session_token') ??
      searchParams.get('token') ??
      '';
    const token = (fromQuery.trim() || readDigilockerSessionTokenFromStorage()).trim();
    if (!token) {
      setStatus('error');
      setError(
        'Missing session token. Open DigiLocker from this app (KYC) so the session is saved, then try again.',
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const out = await downloadDigilockerAadhaar({ sessionToken: token.trim(), consent: true });
        if (cancelled) return;
        if (!out.configured) {
          setStatus('error');
          setError(out.skipReason ?? 'Aadhaar download is not configured on the server.');
          return;
        }
        if (!out.ok) {
          setStatus('error');
          setError(
            typeof out.vendor === 'object' && out.vendor && 'message' in (out.vendor as object)
              ? String((out.vendor as { message?: unknown }).message)
              : `Aadhaar download failed (HTTP ${out.httpStatus ?? 'n/a'}).`,
          );
          return;
        }
        clearDigilockerSessionTokenFromStorage();
        const next = await refresh();
        const href =
          next.authenticated === true && next.lead
            ? getPostDigilockerAadhaarContinuePath(next)
            : '/kyc';
        setContinueHref(href);
        setStatus('done');
        setMessage('Aadhaar details were retrieved. You can continue your application.');
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
  }, [refresh, searchParams]);

  return (
    <div className="mx-auto grid max-w-lg gap-4 p-6">
      <div className="mc-chip w-fit">DigiLocker</div>
      {error ? (
        <>
          <AlertBanner variant="error">{error}</AlertBanner>
          <Link href="/kyc" className="mc-btn-primary text-center">
            Back to KYC
          </Link>
        </>
      ) : (
        <>
          <p className="m-0 text-brand-navy font-semibold leading-relaxed">{message}</p>
          {status === 'done' && (
            <div className="flex flex-wrap gap-3">
              <Link href={continueHref} className="mc-btn-primary text-center">
                Continue
              </Link>
              <Link href="/kyc" className="mc-btn-secondary text-center">
                KYC home
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DigilockerCallbackPage() {
  return (
    <CustomerJourneyGuard>
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Suspense
          fallback={
            <div className="mc-card p-6 text-brand-muted">Loading DigiLocker result…</div>
          }
        >
          <DigilockerCallbackContent />
        </Suspense>
      </div>
    </CustomerJourneyGuard>
  );
}
