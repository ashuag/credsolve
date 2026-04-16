'use client';

import { useEffect } from 'react';
import { captureCustomerUtmParamsFromSearch } from '@/lib/customer-utm';

export function CustomerUtmBootstrap() {
  useEffect(() => {
    captureCustomerUtmParamsFromSearch(window.location.search);
  }, []);

  return null;
}
