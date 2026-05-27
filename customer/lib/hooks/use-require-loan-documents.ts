'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { isLoanDocumentsJourneyComplete } from '@/lib/loan-documents-journey';

/** Sends users to `/loan-documents` when sanction letter OTP is not done yet. */
export function useRequireLoanDocumentsAccepted(): void {
  const router = useRouter();
  const { loading, session } = useCustomerSession();

  useEffect(() => {
    if (loading) return;
    if (session?.authenticated === true && session.lead && !isLoanDocumentsJourneyComplete(session)) {
      router.replace('/loan-documents');
    }
  }, [loading, router, session]);
}
