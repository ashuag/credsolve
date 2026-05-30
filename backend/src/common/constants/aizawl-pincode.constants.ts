import { INDIAN_CITIES } from './city.constants';

/** `INDIAN_CITIES` row for Aizawl, Mizoram. */
export const AIZAWL_CITY_ID = INDIAN_CITIES.find((c) => c.name === 'AIZAWL')!.id;

/** Unique 6-digit pincodes for Aizawl district (from Mizoram post-office list). */
export const AIZAWL_PINCODES = [
  '796001',
  '796005',
  '796007',
  '796009',
  '796012',
  '796014',
  '796015',
  '796017',
  '796025',
  '796036',
  '796111',
  '796161',
  '796190',
  '796230',
  '796261',
  '796410',
  '796471',
  '796581',
] as const;
