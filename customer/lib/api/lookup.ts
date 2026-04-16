import { apiGet } from './client';

type LookupValueResponse = {
  values: Array<{
    id: number;
    name: string;
  }>;
};

async function fetchLookupValues(endpoint: 'gender' | 'occupations' | 'cities'): Promise<LookupValueResponse['values']> {
  const data = await apiGet<LookupValueResponse>(
    `/lookup/${endpoint}`,
    `Unable to load ${endpoint} right now.`
  );

  return Array.isArray(data?.values) ? data.values : [];
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
