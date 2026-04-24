'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';

type JourneyStage = 'details' | 'preApproved' | 'loanSelection' | 'kyc' | 'bankDetails' | 'done';

function stageFromSession(session: ReturnType<typeof useCustomerSession>['session']): JourneyStage {
  if (!session?.authenticated || !session.lead) return 'details';
  const j = session.journey;
  if (!j.detailsCompleted) return 'details';
  if (!j.loanSelectionCompleted) return 'preApproved';
  if (!j.kycCompleted) return 'kyc';
  if (!j.bankDetailsCompleted) return 'bankDetails';
  return 'done';
}

function defaultPathForStage(stage: JourneyStage): string {
  switch (stage) {
    case 'details':
      return '/onboarding?mode=login';
    case 'preApproved':
      return '/pre-approved-loan';
    case 'loanSelection':
      return '/loan-selection';
    case 'kyc':
      return '/kyc/upload-documents';
    case 'bankDetails':
      return '/bank-details';
    case 'done':
      return '/thank-you';
  }
}

function isPathAllowedForStage(stage: JourneyStage, path: string): boolean {
  if (path === '/apply-for-loan' || path === '/login' || path === '/') return true;
  if (path.startsWith('/onboarding')) return true;

  switch (stage) {
    case 'details':
      return path.startsWith('/onboarding');
    case 'preApproved':
      return path === '/pre-approved-loan' || path === '/loan-selection';
    case 'loanSelection':
      return path === '/loan-selection';
    case 'kyc':
      // Skip DigiLocker option page; take users straight to upload-documents.
      return path === '/kyc/upload-documents';
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

    // Not signed in → push to start.
    if (!session?.authenticated) {
      if (pathname !== '/apply-for-loan') {
        router.replace('/apply-for-loan');
      }
      return;
    }

    // Signed in but no active lead → start flow.
    if (!session.lead) {
      router.replace('/apply-for-loan');
      return;
    }

    if (!isPathAllowedForStage(stage, pathname)) {
      router.replace(redirectPath);
    }
  }, [loading, pathname, redirectPath, router, session, stage]);

  return <>{children}</>;
}

