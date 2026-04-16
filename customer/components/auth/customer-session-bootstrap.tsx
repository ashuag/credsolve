'use client';

import { useEffect } from 'react';
import { hydrateCustomerSessionStore } from '@/lib/stores/customer-session-store';

export function CustomerSessionBootstrap() {
  useEffect(() => {
    hydrateCustomerSessionStore();
  }, []);

  return null;
}
