import { INDIAN_CITIES } from './city.constants';

/** `INDIAN_CITIES` row for Vasai-Virar, Maharashtra. */
export const VASAI_VIRAR_CITY_ID = INDIAN_CITIES.find((c) => c.name === 'VASAI-VIRAR')!.id;

/** Pincodes 401102–401304 (inclusive) for Vasai-Virar. */
export const VASAI_VIRAR_PINCODES: readonly string[] = Array.from(
  { length: 401304 - 401102 + 1 },
  (_, i) => `${401102 + i}`.padStart(6, '0'),
);
