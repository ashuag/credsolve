/**
 * Builds the flat snake_case body for CIBIL07 API `POST /api/cibil/soft-pull`.
 *
 * moneyCash captures email / pincode / address on the address step
 * (`POST /auth/lead-details`), which runs before the PAN + bureau step, so these
 * are read straight from `lead_detail`. The caller
 * ({@link Cibil07CibilService}) validates them first and skips the vendor
 * (falls through to the next `cibil_fetch` vendor) when any is missing — no
 * placeholder data is ever sent to the bureau.
 */

const PROVIDER_EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** CIBIL07 API `CibilSoftPullDto` requires `@IsEmail()`. */
export function isProviderEmail(value: string): boolean {
  return value.length > 0 && value.length <= 254 && PROVIDER_EMAIL_RE.test(value);
}

/** CIBIL07 API `CibilSoftPullDto` requires a 6-digit Indian PIN. */
export function isProviderPincode(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value);
}

export type Cibil07SoftPullBody = {
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
  /** `lead_detail.date_of_birth`. */
  dateOfBirth: Date;
  /** `gender.key` (`MALE` / `FEMALE` / `OTHERS`), or null. */
  genderKey: string | null;
  mobileNumber: string;
  panNumber: string;
  /** `lead_detail.email_id` — validated by the caller. */
  email: string;
  /** `lead_detail.pincode` — validated by the caller. */
  pincode: string;
  /** Joined `lead_detail` address — non-empty, validated by the caller. */
  address: string;
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

/** Join `[addressLine1, addressLine2, cityName]` (or similar) into one line. */
export function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0)
    .join(', ');
}

export function buildCibil07SoftPullBody(
  input: BuildSoftPullBodyInput,
): Cibil07SoftPullBody {
  const { firstName, lastName } = splitFullName(input.fullName);

  return {
    first_name: firstName.slice(0, 50),
    last_name: lastName.slice(0, 50),
    dob: formatDobYmd(input.dateOfBirth),
    gender: mapGenderKeyToProvider(input.genderKey),
    email: input.email.trim().toLowerCase(),
    phone_number: input.mobileNumber.trim(),
    pan_card_number: input.panNumber.trim().toUpperCase(),
    address: input.address.trim().slice(0, 255),
    pin_code: input.pincode.trim(),
  };
}
