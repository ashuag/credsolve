'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  isLeadRejectedAndLocked,
  isInternalErrorLead,
  canResumeKycAfterInternalError,
  resolveKycStagePath,
  shouldResumeKycSelfie,
  CUSTOMER_EMAIL_JOURNEY_PATH,
  hasOpenCustomerLoan,
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

/** Routes a signed-out visitor may open without being redirected to apply-for-loan. */
function isGuestAccessiblePath(path: string): boolean {
  return (
    path === '/' ||
    path === '/apply-for-loan' ||
    path === '/my-account' ||
    path === '/login'
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
  if (!j.referencesCompleted || !j.loanDocumentsAccepted) return 'references';
  return 'done';
}

function defaultPathForStage(
  stage: JourneyStage,
  session: ReturnType<typeof useCustomerSession>['session'],
): string {
  switch (stage) {
    case 'kyc':
      return resolveKycStagePath(session);
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
    path === '/active-loan' ||
    path === '/dashboard' ||
    path === '/my-account' ||
    path === '/payments'
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
      // DigiLocker can complete identity capture before the rest of KYC moves;
      // keep /kyc reachable so the hub is not skipped after DigiLocker.
      return path === '/bank-details' || path === '/kyc' || path.startsWith('/kyc/');
    case 'references':
      return path === '/references' || path === '/kyc' || path.startsWith('/kyc/');
    case 'done':
      return true;
  }
}

/** Routes a rejected / locked lead may still open (account hub — not the apply journey). */
function isRejectedLeadHubPath(path: string): boolean {
  return (
    path === '/' ||
    path === '/my-account' ||
    path === '/dashboard' ||
    path === '/payments' ||
    path === '/active-loan' ||
    path === '/thank-you-interest'
  );
}

export function CustomerJourneyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session } = useCustomerSession();

  const stage = useMemo(() => stageFromSession(session), [session]);
  const redirectPath = useMemo(() => defaultPathForStage(stage, session), [session, stage]);

  useEffect(() => {
    if (loading || !pathname) return;

    // Signed out — only public entry routes; journey steps (KYC, thank-you, etc.) → apply.
    if (!session?.authenticated) {
      if (isGuestAccessiblePath(pathname)) {
        return;
      }
      router.replace('/apply-for-loan');
      return;
    }

    // Active / overdue loan — block further application journey; show repay-first screen.
    if (hasOpenCustomerLoan(session)) {
      if (
        pathname === '/active-loan' ||
        pathname === '/my-account' ||
        pathname === '/dashboard' ||
        pathname === '/payments' ||
        pathname === '/'
      ) {
        return;
      }
      if (
        pathname === '/apply-for-loan' ||
        pathname.startsWith('/onboarding') ||
        pathname === '/pre-approved-loan' ||
        pathname === '/loan-selection' ||
        pathname.startsWith('/email-verify') ||
        pathname === '/loan-documents' ||
        pathname.startsWith('/kyc') ||
        pathname === '/bank-details' ||
        pathname === '/references' ||
        pathname === '/thank-you' ||
        pathname === '/loan-offer'
      ) {
        router.replace('/active-loan');
      }
      return;
    }

    if (!session.lead) {
      if (isGuestAccessiblePath(pathname)) {
        return;
      }
      router.replace('/apply-for-loan');
      return;
    }

    if (isLeadRejectedAndLocked(session.lead)) {
      // Keep account hub usable (past loans / repayments); only leave the apply journey.
      if (isRejectedLeadHubPath(pathname)) {
        return;
      }
      router.replace('/thank-you-interest');
      return;
    }

    if (isInternalErrorLead(session.lead)) {
      if (canResumeKycAfterInternalError(session)) {
        const resumePath = shouldResumeKycSelfie(session) ? '/kyc/selfie' : '/kyc';
        if (pathname !== resumePath && !(resumePath === '/kyc' && pathname.startsWith('/kyc/'))) {
          router.replace(resumePath);
        }
        return;
      }
      if (pathname !== '/thank-you') {
        router.replace('/thank-you');
      }
      return;
    }

    // DigiLocker done but selfie/liveness still pending — force face step.
    if (stage === 'kyc' && pathname === '/kyc' && shouldResumeKycSelfie(session)) {
      router.replace('/kyc/selfie');
      return;
    }

    // Bank details require completed KYC — never stay on /bank-details while KYC is open.
    if (pathname === '/bank-details' && !session.journey.kycCompleted) {
      router.replace(resolveKycStagePath(session));
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
