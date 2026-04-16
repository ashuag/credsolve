'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileEntryForm } from '@/app/mobile-entry-form';
import { OtpVerificationForm } from '@/app/login/otp-verification-form';
import { SectionPanel } from '@/components/ui/section-panel';
import { Spinner } from '@/components/ui/spinner';
import type { SendOtpResponse } from '@/lib/api/auth';
import { getCustomerLeadStatus } from '@/lib/api/lead';
import {
  resolveCustomerFlowPath,
  syncCustomerOnboardingStateFromLeadStatus,
  syncCustomerOnboardingStateFromProfile
} from '@/lib/customer-flow';
import { useCustomerSession } from '@/lib/hooks/use-customer-session';

export function MyAccountAccessFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, hasHydrated } = useCustomerSession();
  const [otpRequest, setOtpRequest] = useState<SendOtpResponse | null>(null);
  const [isResolvingFlow, setIsResolvingFlow] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!profile) return;

    syncCustomerOnboardingStateFromProfile(profile);
    setIsResolvingFlow(true);

    let isActive = true;

    void getCustomerLeadStatus()
      .then((leadState) => {
        if (!isActive) return;
        syncCustomerOnboardingStateFromLeadStatus(leadState);
        router.replace(resolveCustomerFlowPath(
          leadState?.leadStatus,
          searchParams.get('mode') === 'login' ? 'login' : 'register'
        ));
      })
      .catch(() => {
        if (!isActive) return;
        router.replace(resolveCustomerFlowPath(
          undefined,
          searchParams.get('mode') === 'login' ? 'login' : 'register'
        ));
      })
      .finally(() => {
        if (isActive) {
          setIsResolvingFlow(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasHydrated, profile, router, searchParams]);

  if (!hasHydrated || isResolvingFlow) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      {otpRequest ? (
        <Suspense
          fallback={
            <div className="flex min-h-[400px] items-center justify-center">
              <Spinner size={40} />
            </div>
          }
        >
          <OtpVerificationForm initialOtpRequest={otpRequest} onChangeNumber={() => setOtpRequest(null)} />
        </Suspense>
      ) : (
        <>
          <SectionPanel
            eyebrow="My Account"
            title="Enter mobile number."
            description="Use your registered mobile number to start a new application or continue an existing one."
          >
            <Suspense
              fallback={
                <div className="flex min-h-[160px] items-center justify-center">
                  <Spinner size={32} />
                </div>
              }
            >
              <MobileEntryForm onSuccess={setOtpRequest} />
            </Suspense>
            <p className="mt-4 text-sm leading-[1.6] text-brand-muted">
              We will send a 6-digit OTP to this number so you can continue securely.
            </p>
          </SectionPanel>

          <aside className="mc-card">
            <div className="mc-chip">How it works</div>
            <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
              Fast mobile access.
            </h2>
            <p className="text-brand-muted leading-[1.6]">
              Whether you are applying for a fresh loan or returning to check progress, your mobile number is the first
              step into the MoneyCash flow.
            </p>
            <div className="grid gap-3 mt-[18px]">
              <div className="mc-inner-card">
                <strong className="text-brand-navy">Step 1</strong>
                <span className="block text-brand-muted leading-[1.6]">Enter your 10-digit mobile number.</span>
              </div>
              <div className="mc-inner-card">
                <strong className="text-brand-navy">Step 2</strong>
                <span className="block text-brand-muted leading-[1.6]">Verify the OTP sent to your phone.</span>
              </div>
              <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
                <strong className="text-brand-navy">Step 3</strong>
                <span className="block text-brand-muted leading-[1.6]">
                  Continue with your application details or open your account journey.
                </span>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
