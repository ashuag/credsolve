'use client';

import { useEffect } from 'react';
import { captureLoanPurposeFromSearch } from '@/lib/loan-purpose-selection';
import { captureCustomerUtmParamsFromSearch } from '@/lib/customer-utm';

export function CustomerUtmBootstrap() {
  useEffect(() => {
    captureCustomerUtmParamsFromSearch(window.location.search);
    captureLoanPurposeFromSearch(window.location.search);
  }, []);

  return null;
}
