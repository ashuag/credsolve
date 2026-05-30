import { INDIAN_CITIES } from './city.constants';

/** `INDIAN_CITIES` row for Hisar, Haryana. */
export const HISAR_CITY_ID = INDIAN_CITIES.find((c) => c.name === 'HISAR')!.id;

export const HISAR_PINCODES = [
  '125001',
  '125002',
  '125003',
  '125004',
  '125005',
  '125006',
  '125007',
] as const;
