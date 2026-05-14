'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { getCustomerJourneyResumePath } from '@/lib/api/customer-session';

type CustomerLeadStatusGateProps = {
  allowedStatuses: readonly string[];
  children: ReactNode;
};

export function CustomerLeadStatusGate({
  allowedStatuses,
  children,
}: CustomerLeadStatusGateProps) {
  const router = useRouter();
  const { loading, session } = useCustomerSession();
  const [hasResolvedStatus, setHasResolvedStatus] = useState(false);

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    if (!session.authenticated || !session.mobileNumber?.trim()) {
      router.replace('/apply-for-loan');
      return;
    }

    const status = session.lead?.status ?? '';
    if (allowedStatuses.includes(status)) {
      setHasResolvedStatus(true);
      return;
    }

    if (session.lead) {
      router.replace(getCustomerJourneyResumePath(session));
      return;
    }

    router.replace('/my-account?mode=login');
  }, [loading, session, allowedStatuses, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (!session.authenticated || !hasResolvedStatus) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return <>{children}</>;
}
