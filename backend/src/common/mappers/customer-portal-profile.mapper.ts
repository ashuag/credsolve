import { GENDER } from '../constants/gender.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { OCCUPATION } from '../constants/occupation.constants';
import { PAN_VERIFIED } from '../constants/pan-verification.constants';

/** FE `CustomerGenderValue` slugs (customer app). */
export type CustomerPortalGenderSlug = 'male' | 'female' | 'others';

/** FE `CustomerOccupationValue` slugs (customer app). */
export type CustomerPortalOccupationSlug =
  | 'salaried'
  | 'self_employed_professional'
  | 'self_employed_business'
  | 'student'
  | 'homemaker'
  | 'retired';

const GENDER_DB_TO_SLUG: Record<string, CustomerPortalGenderSlug> = {
  [GENDER.MALE]: 'male',
  [GENDER.FEMALE]: 'female',
  [GENDER.OTHERS]: 'others',
};

const OCC_DB_TO_SLUG: Record<string, CustomerPortalOccupationSlug> = {
  [OCCUPATION.SALARIED]: 'salaried',
  [OCCUPATION.SELF_EMPLOYED_PROFESSIONAL]: 'self_employed_professional',
  [OCCUPATION.SELF_EMPLOYED_BUSINESS]: 'self_employed_business',
  [OCCUPATION.STUDENT]: 'student',
  [OCCUPATION.HOMEMAKER]: 'homemaker',
  [OCCUPATION.RETIRED]: 'retired',
};

function decimalToString(value: { toString(): string } | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value.toString();
}

/** ISO date-only string for portal; never throws on bad DB values. */
function formatDateOfBirthForPortal(dateOfBirth: Date | null | undefined): string | null {
  if (dateOfBirth == null) {
    return null;
  }
  const t = dateOfBirth.getTime();
  if (Number.isNaN(t)) {
    return null;
  }
  try {
    return dateOfBirth.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export function mapGenderDbNameToPortalSlug(name: string | null | undefined): CustomerPortalGenderSlug | null {
  if (!name) return null;
  return GENDER_DB_TO_SLUG[name] ?? null;
}

export function mapOccupationDbNameToPortalSlug(name: string | null | undefined): CustomerPortalOccupationSlug | null {
  if (!name) return null;
  return OCC_DB_TO_SLUG[name] ?? null;
}

export function isLeadEmailVerifiedForPortal(leadStatusName: string, email: string | null, emailVerificationType: unknown): boolean {
  if (leadStatusName === LEAD_STATUS.IN_PROGRESS || leadStatusName === LEAD_STATUS.CONVERTED) {
    return true;
  }
  return Boolean(email?.trim()) && emailVerificationType != null;
}

export function formatLeadDetailForPortal(detail: {
  fullName: string | null;
  dateOfBirth: Date | null;
  panNumber: string | null;
  panVerified?: boolean | number | null;
  panVerifiedAt?: Date | null;
  addressLine1: string | null;
  addressLine2: string | null;
  pincode: string | null;
  netMonthlyIncome: { toString(): string } | null;
  annualTurnover: { toString(): string } | null;
  annualProfit: { toString(): string } | null;
  cibilConsentAt: Date | null;
  gender: { name: string } | null;
  occupation: { name: string } | null;
  city: { name: string; state: { code: string } } | null;
} | null): {
  fullName: string | null;
  dob: string | null;
  panNumber: string | null;
  gender: CustomerPortalGenderSlug | null;
  occupation: CustomerPortalOccupationSlug | null;
  addressLine1: string | null;
  addressLine2: string | null;
  currentCity: string | null;
  pincode: string | null;
  monthlyIncome: string | null;
  annualTurnover: string | null;
  annualProfit: string | null;
  creditConsentAccepted: boolean;
  panVerified: boolean;
  panVerifiedAt: string | null;
} | null {
  if (!detail) {
    return null;
  }

  const dob = formatDateOfBirthForPortal(detail.dateOfBirth);

  const currentCity =
    detail.city != null ? `${detail.city.name}, ${detail.city.state.code}` : null;

  return {
    fullName: detail.fullName,
    dob,
    panNumber: detail.panNumber,
    panVerified: isPanVerifiedFromDb(detail.panVerified),
    panVerifiedAt: detail.panVerifiedAt?.toISOString() ?? null,
    gender: mapGenderDbNameToPortalSlug(detail.gender?.name),
    occupation: mapOccupationDbNameToPortalSlug(detail.occupation?.name),
    addressLine1: detail.addressLine1,
    addressLine2: detail.addressLine2,
    currentCity,
    pincode: detail.pincode,
    monthlyIncome: decimalToString(detail.netMonthlyIncome),
    annualTurnover: decimalToString(detail.annualTurnover),
    annualProfit: decimalToString(detail.annualProfit),
    creditConsentAccepted: detail.cibilConsentAt != null,
  };
}
