'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { Spinner } from '@/components/ui/spinner';

/** Manual CKYC upload was removed — DigiLocker is the only KYC path. */
export default function KycUploadDocumentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/kyc');
  }, [router]);

  return (
    <CustomerJourneyGuard>
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    </CustomerJourneyGuard>
  );
}
