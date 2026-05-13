import { GENDER } from '../constants/gender.constants';
import { OCCUPATION } from '../constants/occupation.constants';

/** Customer portal / API slug → `gender.name` in DB. */
export const GENDER_SLUG_TO_DB: Record<string, string> = {
  male: GENDER.MALE,
  female: GENDER.FEMALE,
  others: GENDER.OTHERS,
};

/** Customer portal / API slug → `occupation.name` in DB. */
export const OCCUPATION_SLUG_TO_DB: Record<string, string> = {
  salaried: OCCUPATION.SALARIED,
  self_employed_professional: OCCUPATION.SELF_EMPLOYED_PROFESSIONAL,
  self_employed_business: OCCUPATION.SELF_EMPLOYED_BUSINESS,
  student: OCCUPATION.STUDENT,
  homemaker: OCCUPATION.HOMEMAKER,
  retired: OCCUPATION.RETIRED,
};
