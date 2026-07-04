'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  isLeadRejectedAndLocked,
  isInternalErrorLead,
  canResumeKycAfterInternalError,
  CUSTOMER_EMAIL_JOURNEY_PATH,
} from '@/lib/api/customer-session';
import { isLoanDocumentsJourneyComplete } from '@/lib/loan-documents-journey';

type JourneyStage =
  | 'details'
  | 'preApproved'
  | 'email'
  | 'loanDocuments'
  | 'kyc'
  | 'bankDetails'
  | 'references'
  | 'done';

/** In-progress application routes — never race these to apply-for-loan while session hydrates. */
function isInJourneyPath(path: string): boolean {
  return (
    path === '/pre-approved-loan' ||
    path === '/loan-selection' ||
    path.startsWith('/email-verify') ||
    path.startsWith('/onboarding') ||
    path === '/loan-documents' ||
    path === '/kyc' ||
    path.startsWith('/kyc/') ||
    path === '/bank-details' ||
    path === '/references'
  );
}

function stageFromSession(session: ReturnType<typeof useCustomerSession>['session']): JourneyStage {
  if (!session?.authenticated || !session.lead) return 'details';
  const j = session.journey;
  if (!j.detailsCompleted) return 'details';
  if (!j.loanSelectionCompleted) return 'preApproved';
  if (!session.lead.emailVerified) return 'email';
  if (!isLoanDocumentsJourneyComplete(session)) return 'loanDocuments';
  if (!j.kycCompleted) return 'kyc';
  if (!j.bankDetailsCompleted) return 'bankDetails';
  if (!j.referencesCompleted) return 'references';
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
    case 'email':
      return CUSTOMER_EMAIL_JOURNEY_PATH;
    case 'loanDocuments':
      return '/loan-documents';
    case 'references':
      return '/references';
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
    path === '/thank-you-interest' ||
    path === '/dashboard' ||
    path === '/my-account'
  ) {
    return true;
  }

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
    case 'email':
      return path.startsWith('/email-verify') || path.startsWith('/onboarding');
    case 'loanDocuments':
      return path === '/loan-documents';
    case 'bankDetails':
      return path === '/bank-details';
    case 'references':
      return path === '/references';
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

    const inJourney = isInJourneyPath(pathname);

    // Session still hydrating — stay on journey pages; do NOT refresh here (causes /auth/me loops).
    if (!session?.authenticated) {
      if (inJourney || pathname === '/apply-for-loan' || pathname === '/thank-you' || pathname === '/my-account') {
        return;
      }
      router.replace('/apply-for-loan');
      return;
    }

    if (!session.lead) {
      if (inJourney || pathname === '/thank-you' || pathname === '/my-account') {
        return;
      }
      router.replace('/apply-for-loan');
      return;
    }

    if (isLeadRejectedAndLocked(session.lead)) {
      if (pathname !== '/thank-you-interest') {
        router.replace('/thank-you-interest');
      }
      return;
    }

    if (isInternalErrorLead(session.lead)) {
      if (canResumeKycAfterInternalError(session)) {
        if (pathname !== '/kyc/selfie' && !pathname.startsWith('/kyc/selfie/')) {
          router.replace('/kyc/selfie');
        }
        return;
      }
      if (pathname !== '/thank-you') {
        router.replace('/thank-you');
      }
      return;
    }

    if (!isPathAllowedForStage(stage, pathname)) {
      if (pathname === '/pre-approved-loan' && !session.journey.loanSelectionCompleted) {
        return;
      }
      if (
        (pathname.startsWith('/email-verify') || pathname === '/loan-selection') &&
        session.journey.detailsCompleted
      ) {
        return;
      }
      router.replace(redirectPath);
    }
  }, [loading, pathname, redirectPath, router, session, stage]);

  return <>{children}</>;
}
