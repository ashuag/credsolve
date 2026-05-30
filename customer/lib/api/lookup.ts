import { ApiRequestError, apiGet } from './client';

type LookupValueResponse = {
  values: Array<{
    id: number;
    name: string;
  }>;
};

async function fetchLookupValues(
  endpoint: 'gender' | 'occupations' | 'cities' | 'reference-relations',
): Promise<LookupValueResponse['values']> {
  try {
    const data = await apiGet<LookupValueResponse>(
      `/lookup/${endpoint}`,
      `Unable to load ${endpoint} right now.`
    );

    return Array.isArray(data?.values) ? data.values : [];
  } catch (e) {
    if (e instanceof ApiRequestError && (e.statusCode === 404 || e.statusCode === 405 || e.statusCode === 501)) {
      return [];
    }
    throw e;
  }
}

export async function fetchCustomerGenderLookupValues() {
  return fetchLookupValues('gender');
}

export async function fetchCustomerOccupationLookupValues() {
  return fetchLookupValues('occupations');
}

export async function fetchCustomerCityLookupValues() {
  return fetchLookupValues('cities');
}

export async function fetchCustomerReferenceRelationLookupValues() {
  return fetchLookupValues('reference-relations');
}

export type PincodeLookupValue = {
  code: string;
  cityId: number;
  cityName: string;
  stateId: number;
  stateCode: string;
  stateName: string;
};

export async function fetchPincodeLookup(code: string): Promise<PincodeLookupValue | null> {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }

  try {
    const data = await apiGet<{ value: PincodeLookupValue | null }>(
      `/lookup/pincodes?code=${encodeURIComponent(normalized)}`,
      'Unable to look up pincode right now.',
    );
    return data?.value ?? null;
  } catch (e) {
    if (e instanceof ApiRequestError && (e.statusCode === 404 || e.statusCode === 405 || e.statusCode === 501)) {
      return null;
    }
    throw e;
  }
}
