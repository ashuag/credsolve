'use client';

import { useEffect, useState } from 'react';
import { fetchCustomerGenderLookupValues, fetchCustomerOccupationLookupValues } from './api/lookup';
import { mapLookupToOption, type CustomerLookupOption } from './customer-details';

type CustomerDetailLookupState = {
  genderOptions: CustomerLookupOption[];
  occupationOptions: CustomerLookupOption[];
  isLoading: boolean;
};

type LookupCache = {
  genderOptions: CustomerLookupOption[];
  occupationOptions: CustomerLookupOption[];
};

let lookupCache: LookupCache | null = null;

function dedupeOptions(options: CustomerLookupOption[]) {
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}

export function useCustomerDetailLookups(): CustomerDetailLookupState {
  const [genderOptions, setGenderOptions] = useState<CustomerLookupOption[]>([]);
  const [occupationOptions, setOccupationOptions] = useState<CustomerLookupOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadLookups() {
      if (lookupCache) {
        if (!isActive) return;
        setGenderOptions(lookupCache.genderOptions);
        setOccupationOptions(lookupCache.occupationOptions);
        setIsLoading(false);
        return;
      }

      try {
        const [genderResult, occupationResult] = await Promise.allSettled([
          fetchCustomerGenderLookupValues(),
          fetchCustomerOccupationLookupValues(),
        ]);

        if (!isActive) return;

        const genderValues = genderResult.status === 'fulfilled' ? genderResult.value : [];
        const occupationValues = occupationResult.status === 'fulfilled' ? occupationResult.value : [];

        const nextGenderOptions = dedupeOptions(
          genderValues.filter((v) => v.key && v.name).map(mapLookupToOption)
        );
        const nextOccupationOptions = dedupeOptions(
          occupationValues.filter((v) => v.key && v.name).map(mapLookupToOption)
        );

        lookupCache = { genderOptions: nextGenderOptions, occupationOptions: nextOccupationOptions };
        setGenderOptions(nextGenderOptions);
        setOccupationOptions(nextOccupationOptions);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadLookups();
    return () => { isActive = false; };
  }, []);

  return { genderOptions, occupationOptions, isLoading };
}
