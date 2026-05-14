'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { getCustomerPostAuthResumePath } from '@/lib/api/customer-session';
import { useCustomerSession } from '@/components/providers/customer-session-provider';

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const currentUrl = new URL(window.location.href);
      const params = currentUrl.searchParams;
      const success = params.get('success') === '1';
      const callbackError = params.get('error');
      const emailMode = params.get('mode') === 'login' ? 'login' : 'register';

      window.history.replaceState(null, '', window.location.pathname);

      if (callbackError) {
        if (isActive) setError(decodeURIComponent(callbackError));
        return;
      }

      if (!success) {
        if (isActive) setError('Google login could not be completed.');
        return;
      }

      try {
        const nextSession = await refresh();

        startTransition(() => {
          router.replace(getCustomerPostAuthResumePath(nextSession, emailMode));
        });
      } catch (callbackPayloadError) {
        if (isActive) {
          setError(
            callbackPayloadError instanceof Error
              ? callbackPayloadError.message
              : 'Unable to refresh your session after Google sign-in.'
          );
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [router, refresh]);

  if (!error) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="mc-card w-full max-w-[560px] text-center">
          <div className="mc-chip mx-auto w-fit">Google login</div>
          <h1 className="mt-4 text-brand-navy text-[clamp(2rem,5vw,2.8rem)] tracking-[-0.04em]">
            Signing you in.
          </h1>
          <p className="mt-3 text-brand-muted leading-[1.6]">
            We are finishing your Google login and updating your MoneyCash application.
          </p>
          <div className="mx-auto mt-6 flex justify-center">
            <Spinner size={40} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="mc-card w-full max-w-[560px]">
        <div className="mc-chip">Google login</div>
        <h1 className="mt-4 text-brand-navy text-[clamp(2rem,5vw,2.8rem)] tracking-[-0.04em]">
          Sign-in failed.
        </h1>
        <p className="mt-3 text-brand-muted leading-[1.6]">{error}</p>
        <Link href="/onboarding" className="mc-btn-primary mt-6 inline-flex justify-center">
          Try again
        </Link>
      </div>
    </div>
  );
}
