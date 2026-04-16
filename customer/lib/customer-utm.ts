import type { CustomerUtmParams } from './customer-auth';

const UTM_QUERY_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

let currentCustomerUtmParams: CustomerUtmParams | null = null;

function normalizeUtmValue(value: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue.slice(0, 100) : undefined;
}

export function readCustomerUtmParams(): CustomerUtmParams | null {
  return currentCustomerUtmParams;
}

export function captureCustomerUtmParamsFromSearch(search: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const searchParams = new URLSearchParams(search);
  const hasAnyUtmParam = UTM_QUERY_KEYS.some((key) => searchParams.has(key));

  if (!hasAnyUtmParam) {
    return;
  }

  currentCustomerUtmParams = {
    utmSource: normalizeUtmValue(searchParams.get('utm_source')),
    utmMedium: normalizeUtmValue(searchParams.get('utm_medium')),
    utmCampaign: normalizeUtmValue(searchParams.get('utm_campaign')),
    utmTerm: normalizeUtmValue(searchParams.get('utm_term')),
    utmContent: normalizeUtmValue(searchParams.get('utm_content'))
  };
}
