'use client';

import { useEffect, useState } from 'react';
import {
  getCustomerProfile,
  hydrateCustomerSessionStore,
  CUSTOMER_SESSION_EVENT,
} from '@/lib/stores/customer-session-store';
import type { CustomerProfile } from '@/lib/customer-auth';

export function useCustomerSession(): {
  profile: CustomerProfile | null;
  hasHydrated: boolean;
} {
  const [profile, setProfile] = useState<CustomerProfile | null>(getCustomerProfile());
  const [hasHydrated, setHasHydrated] = useState(() => getCustomerProfile() !== null);

  useEffect(() => {
    function handleSessionChange() {
      setProfile(getCustomerProfile());
      setHasHydrated(true);
    }

    window.addEventListener(CUSTOMER_SESSION_EVENT, handleSessionChange);

    void hydrateCustomerSessionStore().then(() => {
      setProfile(getCustomerProfile());
      setHasHydrated(true);
    });

    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, handleSessionChange);
    };
  }, []);

  return { profile, hasHydrated };
}
