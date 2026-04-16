'use client';

import { useEffect, useState } from 'react';
import {
  fetchCustomerCityLookupValues,
  fetchCustomerGenderLookupValues,
  fetchCustomerOccupationLookupValues
} from './api/lookup';
import {
  CUSTOMER_GENDER_OPTIONS,
  CUSTOMER_OCCUPATION_OPTIONS,
  mapGenderLookupNameToOption,
  mapOccupationLookupNameToOption,
  type CustomerGenderValue,
  type CustomerLookupOption,
  type CustomerOccupationValue
} from './customer-details';

type CustomerDetailLookupState = {
  cityOptions: string[];
  genderOptions: Array<CustomerLookupOption<CustomerGenderValue>>;
  occupationOptions: Array<CustomerLookupOption<CustomerOccupationValue>>;
  isLoading: boolean;
};

type LookupCache = {
  cityOptions: string[];
  genderOptions: Array<CustomerLookupOption<CustomerGenderValue>>;
  occupationOptions: Array<CustomerLookupOption<CustomerOccupationValue>>;
};

let lookupCache: LookupCache | null = null;

function dedupeOptions<T extends string>(options: Array<CustomerLookupOption<T>>) {
  const seenValues = new Set<T>();

  return options.filter((option) => {
    if (seenValues.has(option.value)) {
      return false;
    }

    seenValues.add(option.value);
    return true;
  });
}

export function useCustomerDetailLookups(): CustomerDetailLookupState {
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [genderOptions, setGenderOptions] = useState<Array<CustomerLookupOption<CustomerGenderValue>>>([]);
  const [occupationOptions, setOccupationOptions] = useState<Array<CustomerLookupOption<CustomerOccupationValue>>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadLookups() {
      if (lookupCache) {
        if (!isActive) return;
        setCityOptions(lookupCache.cityOptions);
        setGenderOptions(lookupCache.genderOptions);
        setOccupationOptions(lookupCache.occupationOptions);
        setIsLoading(false);
        return;
      }

      try {
        const [cityResult, genderResult, occupationResult] = await Promise.allSettled([
          fetchCustomerCityLookupValues(),
          fetchCustomerGenderLookupValues(),
          fetchCustomerOccupationLookupValues()
        ]);

        const cityValues = cityResult.status === 'fulfilled' ? cityResult.value : [];
        const genderValues = genderResult.status === 'fulfilled' ? genderResult.value : [];
        const occupationValues = occupationResult.status === 'fulfilled' ? occupationResult.value : [];

        if (!isActive) {
          return;
        }

        const nextCityOptions = Array.from(
          new Set(
            cityValues
              .map((value) => value.name.trim())
              .filter((value) => value.length > 0)
          )
        );

        const nextGenderOptions = dedupeOptions(
          genderValues
            .map((value) => mapGenderLookupNameToOption(value.name))
            .filter((option): option is CustomerLookupOption<CustomerGenderValue> => option !== null)
        );
        const nextOccupationOptions = dedupeOptions(
          occupationValues
            .map((value) => mapOccupationLookupNameToOption(value.name))
            .filter((option): option is CustomerLookupOption<CustomerOccupationValue> => option !== null)
        );

        const resolvedGenderOptions = nextGenderOptions.length > 0 ? nextGenderOptions : CUSTOMER_GENDER_OPTIONS;
        const resolvedOccupationOptions = nextOccupationOptions.length > 0 ? nextOccupationOptions : CUSTOMER_OCCUPATION_OPTIONS;

        lookupCache = {
          cityOptions: nextCityOptions,
          genderOptions: resolvedGenderOptions,
          occupationOptions: resolvedOccupationOptions
        };

        setCityOptions(nextCityOptions);
        setGenderOptions(resolvedGenderOptions);
        setOccupationOptions(resolvedOccupationOptions);
      } catch {
        if (!isActive) {
          return;
        }

        setCityOptions([]);
        setGenderOptions(CUSTOMER_GENDER_OPTIONS);
        setOccupationOptions(CUSTOMER_OCCUPATION_OPTIONS);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadLookups();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    cityOptions,
    genderOptions,
    occupationOptions,
    isLoading
  };
}
