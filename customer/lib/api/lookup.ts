import { ApiRequestError, apiGet } from './client';

type LookupValueResponse = {
  values: Array<{
    id: number;
    name: string;
  }>;
};

async function fetchLookupValues(endpoint: 'gender' | 'occupations' | 'cities'): Promise<LookupValueResponse['values']> {
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
