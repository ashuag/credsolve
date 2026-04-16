'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { getCustomerLeadStatus } from '@/lib/api/lead';
import {
  resolveCustomerFlowPath,
  syncCustomerOnboardingStateFromLeadStatus,
  syncCustomerOnboardingStateFromProfile
} from '@/lib/customer-flow';
import { useCustomerSession } from '@/lib/hooks/use-customer-session';

type CustomerLeadStatusGateProps = {
  allowedStatuses: readonly string[];
  children: ReactNode;
};

export function CustomerLeadStatusGate({
  allowedStatuses,
  children,
}: CustomerLeadStatusGateProps) {
  const router = useRouter();
  const { profile, hasHydrated } = useCustomerSession();
  const [hasResolvedStatus, setHasResolvedStatus] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!profile) {
      router.replace('/apply-for-loan');
      return;
    }

    syncCustomerOnboardingStateFromProfile(profile);

    let isActive = true;

    void getCustomerLeadStatus()
      .then((leadState) => {
        if (!isActive) return;
        syncCustomerOnboardingStateFromLeadStatus(leadState);

        if (allowedStatuses.includes(leadState?.leadStatus ?? '')) {
          setHasResolvedStatus(true);
          return;
        }

        router.replace(resolveCustomerFlowPath(leadState?.leadStatus));
      })
      .catch(() => {
        if (!isActive) return;
        router.replace(resolveCustomerFlowPath(undefined));
      });

    return () => {
      isActive = false;
    };
  }, [allowedStatuses, hasHydrated, profile, router]);

  if (!hasHydrated || !hasResolvedStatus) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return <>{children}</>;
}
