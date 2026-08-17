'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { isLeadRejectedAndLocked } from '@/lib/api/customer-session';
import { Spinner } from '@/components/ui/spinner';

const REJECTION_PATH = '/thank-you-interest';

/**
 * After a REJECTED / BLACKLISTED lead, keep the customer off My Account and
 * Apply-for-loan. They see the rejection page, which then signs them out.
 */
export function RejectedLeadSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session } = useCustomerSession();

  const rejected =
    Boolean(session?.authenticated && session.lead && isLeadRejectedAndLocked(session.lead));

  useEffect(() => {
    if (loading || !pathname) return;
    if (!rejected) return;
    if (pathname === REJECTION_PATH) return;
    router.replace(REJECTION_PATH);
  }, [loading, pathname, rejected, router]);

  if (!loading && rejected && pathname !== REJECTION_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return <>{children}</>;
}
