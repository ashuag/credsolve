'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { CUSTOMER_EMAIL_VERIFY_PATH } from '@/lib/api/customer-session';

type JourneyStage = 'details' | 'preApproved' | 'loanSelection' | 'email' | 'kyc' | 'bankDetails' | 'done';

function stageFromSession(session: ReturnType<typeof useCustomerSession>['session']): JourneyStage {
  if (!session?.authenticated || !session.lead) return 'details';
  const j = session.journey;
  if (!j.detailsCompleted) return 'details';
  if (!j.loanSelectionCompleted) return 'preApproved';
  if (!session.lead.emailVerified) return 'email';
  if (!j.kycCompleted) return 'kyc';
  if (!j.bankDetailsCompleted) return 'bankDetails';
  return 'done';
}

function defaultPathForStage(stage: JourneyStage): string {
  switch (stage) {
    case 'kyc':
      return '/kyc';
    case 'details':
      return '/onboarding?mode=login';
    case 'preApproved':
      return '/pre-approved-loan';
    case 'loanSelection':
      return '/loan-selection';
    case 'email':
      return CUSTOMER_EMAIL_VERIFY_PATH;
    case 'bankDetails':
      return '/bank-details';
    case 'done':
      return '/thank-you';
  }
}

function isPathAllowedForStage(stage: JourneyStage, path: string): boolean {
  if (
    path === '/apply-for-loan' ||
    path === '/login' ||
    path === '/' ||
    path === '/thank-you' ||
    path === '/dashboard'
  ) {
    return true;
  }

  // DigiLocker OAuth return must stay on this route for every stage (otherwise guard sends users to bank).
  if (path === '/kyc/digilocker-callback') {
    return true;
  }

  switch (stage) {
    case 'kyc':
      return path === '/kyc' || path.startsWith('/kyc/');
    case 'details':
      return path.startsWith('/onboarding');
    case 'preApproved':
      return path === '/pre-approved-loan' || path === '/loan-selection';
    case 'loanSelection':
      return path === '/loan-selection';
    case 'email':
      return path.startsWith('/email-verify') || path.startsWith('/onboarding');
    case 'bankDetails':
      return path === '/bank-details';
    case 'done':
      return true;
  }
}

export function CustomerJourneyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session } = useCustomerSession();

  const stage = useMemo(() => stageFromSession(session), [session]);
  const redirectPath = useMemo(() => defaultPathForStage(stage), [stage]);

  useEffect(() => {
    if (loading || !pathname) return;

    // Not signed in → push to start (thank-you is public so customers still see confirmation after submit or via link).
    if (!session?.authenticated) {
      if (pathname !== '/apply-for-loan' && pathname !== '/thank-you') {
        router.replace('/apply-for-loan');
      }
      return;
    }

    // Signed in but no active lead → start flow (still allow confirmation page).
    if (!session.lead) {
      if (pathname !== '/thank-you') {
        router.replace('/apply-for-loan');
      }
      return;
    }

    if (!isPathAllowedForStage(stage, pathname)) {
      router.replace(redirectPath);
    }
  }, [loading, pathname, redirectPath, router, session, stage]);

  return <>{children}</>;
}
