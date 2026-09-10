import { GENDER, type GenderKey } from '../constants/gender.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { OCCUPATION, type OccupationKey } from '../constants/occupation.constants';
import { PAN_VERIFIED } from '../constants/pan-verification.constants';

/** FE `CustomerGenderValue` keys (customer app). */
export type CustomerPortalGenderSlug = GenderKey;

/** FE `CustomerOccupationValue` keys (customer app). */
export type CustomerPortalOccupationSlug = OccupationKey;

const GENDER_DB_TO_SLUG: Record<string, CustomerPortalGenderSlug> = Object.fromEntries(
  Object.values(GENDER).map(({ key, name }) => [name, key]),
);

const OCC_DB_TO_SLUG: Record<string, CustomerPortalOccupationSlug> = Object.fromEntries(
  Object.values(OCCUPATION).map(({ key, name }) => [name, key]),
);

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

/** True when `lead_detail.pan_verified` / stored detail reflects a successful vendor verification. */
export function isPanVerifiedFromDb(panVerified: boolean | number | null | undefined): boolean {
  if (panVerified === true) {
    return true;
  }
  if (typeof panVerified === 'number') {
    return panVerified === PAN_VERIFIED.VERIFIED;
  }
  return false;
}

export function isLeadEmailVerifiedForPortal(
  leadStatusName: string,
  email: string | null,
  emailVerificationType: unknown
): boolean {
  return Boolean(email?.trim()) && emailVerificationType != null;
}

export type FormattedPortalProfile = {
  fullName: string | null;
  dob: string | null;
  panNumber: string | null;
  gender: CustomerPortalGenderSlug | null;
  occupation: CustomerPortalOccupationSlug | null;
  addressLine1: string | null;
  addressLine2: string | null;
  emailId: string | null;
  currentCity: string | null;
  pincode: string | null;
  monthlyIncome: string | null;
  annualTurnover: string | null;
  annualProfit: string | null;
  creditConsentAccepted: boolean;
  panVerified: boolean;
  panVerifiedAt: string | null;
};

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Fills empty fields on the current (new) lead from a recurring customer’s
 * last repaid loan. Never copies CIBIL consent or PAN verification.
 */
export function mergePortalProfileWithPriorPrefill(
  current: FormattedPortalProfile | null,
  prior: FormattedPortalProfile | null,
): FormattedPortalProfile | null {
  if (!prior) return current;
  if (!current) {
    return {
      ...prior,
      creditConsentAccepted: false,
      panVerified: false,
      panVerifiedAt: null,
    };
  }

  return {
    fullName: blankToNull(current.fullName) ?? prior.fullName,
    dob: blankToNull(current.dob) ?? prior.dob,
    panNumber: blankToNull(current.panNumber) ?? prior.panNumber,
    gender: current.gender ?? prior.gender,
    occupation: current.occupation ?? prior.occupation,
    addressLine1: blankToNull(current.addressLine1) ?? prior.addressLine1,
    addressLine2: blankToNull(current.addressLine2) ?? prior.addressLine2,
    emailId: blankToNull(current.emailId) ?? prior.emailId,
    currentCity: blankToNull(current.currentCity) ?? prior.currentCity,
    pincode: blankToNull(current.pincode) ?? prior.pincode,
    monthlyIncome: blankToNull(current.monthlyIncome) ?? prior.monthlyIncome,
    annualTurnover: blankToNull(current.annualTurnover) ?? prior.annualTurnover,
    annualProfit: blankToNull(current.annualProfit) ?? prior.annualProfit,
    creditConsentAccepted: current.creditConsentAccepted,
    panVerified: current.panVerified,
    panVerifiedAt: current.panVerifiedAt,
  };
}

export function formatLeadDetailForPortal(detail: {
  fullName: string | null;
  dateOfBirth: Date | null;
  panNumber: string | null;
  panVerified?: boolean | number | null;
  panVerifiedAt?: Date | null;
  addressLine1: string | null;
  addressLine2: string | null;
  emailId?: string | null;
  pincode: string | null;
  netMonthlyIncome: { toString(): string } | null;
  annualTurnover: { toString(): string } | null;
  annualProfit: { toString(): string } | null;
  cibilConsentAt: Date | null;
  gender: { key?: string; name: string } | null;
  occupation: { key?: string; name: string } | null;
  city: { name: string; state: { code: string } } | null;
} | null): FormattedPortalProfile | null {
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
    gender: (detail.gender?.key as CustomerPortalGenderSlug | undefined)
      ?? mapGenderDbNameToPortalSlug(detail.gender?.name),
    occupation: (detail.occupation?.key as CustomerPortalOccupationSlug | undefined)
      ?? mapOccupationDbNameToPortalSlug(detail.occupation?.name),
    addressLine1: detail.addressLine1,
    addressLine2: detail.addressLine2,
    emailId: blankToNull(detail.emailId),
    currentCity,
    pincode: detail.pincode,
    monthlyIncome: decimalToString(detail.netMonthlyIncome),
    annualTurnover: decimalToString(detail.annualTurnover),
    annualProfit: decimalToString(detail.annualProfit),
    creditConsentAccepted: detail.cibilConsentAt != null,
  };
}
