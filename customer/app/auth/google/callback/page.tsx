'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomerLeadStatus, syncLeadEmail, type CustomerLeadStatusResponse } from '@/lib/api/lead';
import { resolveCustomerFlowPath, syncCustomerOnboardingStateFromLeadStatus } from '@/lib/customer-flow';
import { clearCustomerOnboardingState, updateCustomerOnboardingState } from '@/lib/stores/customer-onboarding-store';
import { type AuthenticatedCustomer } from '@/lib/customer-auth';

type GoogleSessionPayload = {
  customer: AuthenticatedCustomer;
  verifiedAt: string;
};

function isOptionalText(value: unknown) {
  return value === undefined || value === null || typeof value === 'string';
}

function isGoogleSessionPayload(value: unknown): value is GoogleSessionPayload {
  if (!value || typeof value !== 'object') return false;

  const session = value as Partial<GoogleSessionPayload>;

  if (typeof session.verifiedAt !== 'string') return false;

  const customer = session.customer;

  return (
    typeof customer?.customerId === 'string'
    && isOptionalText(customer?.mobileNumber)
    && isOptionalText(customer?.email)
    && isOptionalText(customer?.fullName)
  );
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));

  return window.atob(`${normalized}${padding}`);
}

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const currentUrl = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const encodedSession = hash.get('session');
      const callbackError = hash.get('error');
      const emailMode = currentUrl.searchParams.get('mode') === 'login' ? 'login' : 'register';
      const leadId = currentUrl.searchParams.get('leadId')?.trim() || '';

      window.history.replaceState(null, '', window.location.pathname);

      if (callbackError) {
        if (isActive) setError(callbackError);
        return;
      }

      if (!encodedSession) {
        if (isActive) setError('Google login could not be completed.');
        return;
      }

      try {
        const parsed = JSON.parse(decodeBase64Url(encodedSession)) as unknown;

        if (!isGoogleSessionPayload(parsed)) {
          if (isActive) setError('Google login returned an invalid session payload.');
          return;
        }

        const googleEmail = parsed.customer.email?.trim();

        if (!googleEmail) {
          if (isActive) setError('Google login did not return an email address.');
          return;
        }

        const syncResult = await syncLeadEmail({
          ...(leadId ? { leadUuid: leadId } : {}),
          email: googleEmail,
          emailVerified: true,
          verificationType: 'google'
        }).catch(() => null);

        const liveLeadState = await getCustomerLeadStatus().catch(() => null);
        const resolvedLeadState: CustomerLeadStatusResponse | null = liveLeadState ?? (
          syncResult?.leadUuid || leadId
            ? {
                leadId: syncResult?.leadUuid ?? leadId,
                leadStatus: 'EMAIL_VERIFIED'
              }
            : null
        );

        clearCustomerOnboardingState();
        syncCustomerOnboardingStateFromLeadStatus(resolvedLeadState);
        updateCustomerOnboardingState({
          ...(resolvedLeadState?.leadId ? { leadUuid: resolvedLeadState.leadId } : {}),
          email: googleEmail,
          emailMode,
          emailVerified: true,
          fullName: parsed.customer.fullName ?? undefined
        });

        startTransition(() => {
          router.replace(resolveCustomerFlowPath(resolvedLeadState?.leadStatus, emailMode));
        });
      } catch (callbackPayloadError) {
        if (isActive) {
          setError(
            callbackPayloadError instanceof Error
              ? callbackPayloadError.message
              : 'Google login returned an unreadable session payload.'
          );
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [router]);

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
          <div className="mx-auto mt-6 h-[40px] w-[40px] rounded-full border-4 border-[#1c347d1a] border-t-brand-blue animate-spin" />
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
