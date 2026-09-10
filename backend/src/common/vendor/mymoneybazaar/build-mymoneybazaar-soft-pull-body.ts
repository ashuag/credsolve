/**
 * Builds the flat snake_case body for mymoneybazaarApi `POST /api/cibil/soft-pull`.
 *
 * moneyCash captures email / pincode / address on the address step
 * (`POST /auth/lead-details`), which runs before the PAN + bureau step, so these
 * are normally read straight from `lead_detail`. The bureau matches primarily on
 * PAN + mobile + name + DOB, so when a field is still missing (e.g. verify-pan
 * called before the address step) a format-valid placeholder is used that passes
 * the provider's validation (`@IsEmail`, address `MinLength(3)`, PIN `/^[1-9]\d{5}$/`).
 */

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const VALID_PINCODE = /^[1-9]\d{5}$/;
const ADDRESS_FALLBACK = 'Address not on file';

export type MyMoneyBazaarSoftPullBody = {
  first_name: string;
  last_name: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  email: string;
  phone_number: string;
  pan_card_number: string;
  address: string;
  pin_code: string;
};

export type BuildSoftPullBodyInput = {
  /** Full name (from `lead_detail.full_name`, falls back to the vendor request name). */
  fullName: string;
  /** `lead_detail.date_of_birth` — required; caller skips the vendor when absent. */
  dateOfBirth: Date;
  /** `gender.key` (`MALE` / `FEMALE` / `OTHERS`), or null. */
  genderKey: string | null;
  mobileNumber: string;
  panNumber: string;
  /** `lead_detail.email_id` (address step). */
  email: string | null;
  /** `lead_detail.pincode` (address step). */
  pincode: string | null;
  /** `[addressLine1, addressLine2, cityName]` from `lead_detail` (address step). */
  addressParts: Array<string | null | undefined>;
  /** Synthetic email used when `email` is missing / malformed. */
  placeholderEmail: string;
  /** Placeholder PIN used when `pincode` is missing / malformed. */
  placeholderPincode: string;
};

/** `Date` → `YYYY-MM-DD` (UTC — `date_of_birth` is a `@db.Date` stored at UTC midnight). */
export function formatDobYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `MALE` → `Male`, `FEMALE` → `Female`, anything else → `Other`. */
export function mapGenderKeyToProvider(genderKey: string | null): 'Male' | 'Female' | 'Other' {
  switch ((genderKey ?? '').trim().toUpperCase()) {
    case 'MALE':
      return 'Male';
    case 'FEMALE':
      return 'Female';
    default:
      return 'Other';
  }
}

/** Split a full name into first / last; a single token repeats as the last name. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: 'NA', lastName: 'NA' };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: tokens[0] };
  return { firstName: tokens[0], lastName: tokens.slice(1).join(' ') };
}

/** Real email when present and well-formed, otherwise the synthetic placeholder. */
export function resolveEmail(email: string | null, placeholderEmail: string): string {
  const trimmed = (email ?? '').trim();
  if (trimmed.length > 0 && trimmed.length <= 254 && EMAIL_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return placeholderEmail;
}

export function buildMyMoneyBazaarSoftPullBody(
  input: BuildSoftPullBodyInput,
): MyMoneyBazaarSoftPullBody {
  const { firstName, lastName } = splitFullName(input.fullName);

  const address =
    input.addressParts
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p.length > 0)
      .join(', ') || ADDRESS_FALLBACK;

  const pincode =
    input.pincode && VALID_PINCODE.test(input.pincode.trim())
      ? input.pincode.trim()
      : input.placeholderPincode;

  return {
    first_name: firstName.slice(0, 50),
    last_name: lastName.slice(0, 50),
    dob: formatDobYmd(input.dateOfBirth),
    gender: mapGenderKeyToProvider(input.genderKey),
    email: resolveEmail(input.email, input.placeholderEmail),
    phone_number: input.mobileNumber.trim(),
    pan_card_number: input.panNumber.trim().toUpperCase(),
    address: address.slice(0, 255),
    pin_code: pincode,
  };
}

/** Default synthetic email (passes `@IsEmail`); overridable via `MMB_CIBIL_PLACEHOLDER_EMAIL`. */
export function defaultPlaceholderEmail(mobileNumber: string): string {
  const digits = mobileNumber.replace(/\D/g, '') || 'customer';
  return `noreply+${digits}@moneycash.in`;
}
