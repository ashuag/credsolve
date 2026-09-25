import { extractProfileFromDigilockerFormJson } from './digilocker-form-profile.util';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Normalize person name for equality checks (Aadhaar vs profile). */
export function normalizePersonNameForMatch(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokensSorted(normalized: string): string {
  return normalized
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

export function personNamesMatch(profileName: string, aadhaarName: string): boolean {
  const a = normalizePersonNameForMatch(profileName);
  const b = normalizePersonNameForMatch(aadhaarName);
  if (!a || !b) return false;
  if (a === b) return true;
  return nameTokensSorted(a) === nameTokensSorted(b);
}

export function dateToUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extractAadhaarIdentityFromVendor(vendor: unknown): {
  fullName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
} {
  if (!isRecord(vendor)) {
    return { fullName: null, dateOfBirth: null, gender: null };
  }
  const data = isRecord(vendor.data) ? vendor.data : vendor;
  const fromData = extractProfileFromDigilockerFormJson(data);
  if (fromData.fullName && fromData.dateOfBirth) {
    return fromData;
  }
  // Surepass DigiLocker nests identity under `aadhaar_xml_data` when not flattened.
  const xmlData = isRecord(data) ? data.aadhaar_xml_data : null;
  if (isRecord(xmlData)) {
    const fromXml = extractProfileFromDigilockerFormJson(xmlData);
    return {
      fullName: fromData.fullName ?? fromXml.fullName,
      dateOfBirth: fromData.dateOfBirth ?? fromXml.dateOfBirth,
      gender: fromData.gender ?? fromXml.gender,
    };
  }
  return fromData;
}

/** Canonical gender for Aadhaar vs lead profile (`M`/`F`/`Male`/`FEMALE`/…). */
export function normalizeGenderForMatch(raw: string | null | undefined): 'MALE' | 'FEMALE' | 'OTHERS' | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().toUpperCase();
  if (value === 'M' || value === 'MALE') return 'MALE';
  if (value === 'F' || value === 'FEMALE') return 'FEMALE';
  if (value === 'T' || value === 'O' || value === 'OTHER' || value === 'OTHERS') return 'OTHERS';
  return null;
}

export type AadhaarIdentityHardRejectReason =
  | 'missing_lead_name'
  | 'missing_lead_dob'
  | 'missing_aadhaar_name'
  | 'missing_aadhaar_dob'
  | 'dob_mismatch'
  | 'gender_mismatch';

export type AadhaarNameMismatchReview = {
  matched: false;
  reason: 'name_mismatch';
  message: string;
};

export type AadhaarLeadIdentityMatchResult =
  | { matched: true }
  | AadhaarNameMismatchReview
  | {
      matched: false;
      reason: AadhaarIdentityHardRejectReason;
      message: string;
    };

/** Name mismatch is credit review (journey continues). DOB / gender / missing fields reject KYC. */
export function isAadhaarNameMismatchReview(
  result: AadhaarLeadIdentityMatchResult,
): result is AadhaarNameMismatchReview {
  return !result.matched && result.reason === 'name_mismatch';
}

/** Read-time flags for LOS application details. Does not reject the lead. */
export type AadhaarKycMismatchFlags = {
  name: boolean;
  dob: boolean;
  gender: boolean;
  messages: string[];
};

/**
 * Independently compare lead profile vs stored Aadhaar (name, DOB, gender).
 * Returns null when Aadhaar identity is not on the payload.
 */
export function compareAadhaarKycMismatchFlags(input: {
  leadFullName: string | null;
  leadDateOfBirth: Date | null;
  leadGender?: string | null;
  vendor: unknown;
}): AadhaarKycMismatchFlags | null {
  const aadhaar = extractAadhaarIdentityFromVendor(input.vendor);
  if (!aadhaar.fullName && !aadhaar.dateOfBirth && !aadhaar.gender) {
    return null;
  }

  const leadName = input.leadFullName?.trim() ?? '';
  const name = Boolean(leadName && aadhaar.fullName && !personNamesMatch(leadName, aadhaar.fullName));

  const dob = Boolean(
    input.leadDateOfBirth &&
      aadhaar.dateOfBirth &&
      dateToUtcYmd(input.leadDateOfBirth) !== dateToUtcYmd(aadhaar.dateOfBirth),
  );

  const leadGender = normalizeGenderForMatch(input.leadGender);
  const aadhaarGender = normalizeGenderForMatch(aadhaar.gender);
  const gender = Boolean(leadGender && aadhaarGender && leadGender !== aadhaarGender);

  const messages: string[] = [];
  if (name) messages.push('Name on Aadhaar does not match the name on the loan application.');
  if (dob) messages.push('Date of birth on Aadhaar does not match the loan application.');
  if (gender) messages.push('Gender on Aadhaar does not match the loan application.');

  return { name, dob, gender, messages };
}

/**
 * Compares lead profile (PAN / personal details) with Aadhaar vendor name / DOB / gender.
 * DOB and gender mismatches reject before name so a combined mismatch cannot slip into review.
 */
export function compareAadhaarToLeadProfile(input: {
  leadFullName: string | null;
  leadDateOfBirth: Date | null;
  leadGender?: string | null;
  vendor: unknown;
}): AadhaarLeadIdentityMatchResult {
  const aadhaar = extractAadhaarIdentityFromVendor(input.vendor);

  if (!aadhaar.fullName) {
    return {
      matched: false,
      reason: 'missing_aadhaar_name',
      message: 'Name was not returned from Aadhaar. KYC cannot be completed.',
    };
  }
  if (!aadhaar.dateOfBirth) {
    return {
      matched: false,
      reason: 'missing_aadhaar_dob',
      message: 'Date of birth was not returned from Aadhaar. KYC cannot be completed.',
    };
  }

  const leadName = input.leadFullName?.trim() ?? '';
  const leadDob = input.leadDateOfBirth;

  if (!leadName) {
    return {
      matched: false,
      reason: 'missing_lead_name',
      message: 'Complete your name in personal details before verifying Aadhaar.',
    };
  }
  if (!leadDob) {
    return {
      matched: false,
      reason: 'missing_lead_dob',
      message: 'Complete your date of birth in personal details before verifying Aadhaar.',
    };
  }

  const leadYmd = dateToUtcYmd(leadDob);
  const aadhaarYmd = dateToUtcYmd(aadhaar.dateOfBirth);
  if (leadYmd !== aadhaarYmd) {
    return {
      matched: false,
      reason: 'dob_mismatch',
      message: 'Date of birth on Aadhaar does not match your loan application.',
    };
  }

  const leadGender = normalizeGenderForMatch(input.leadGender);
  const aadhaarGender = normalizeGenderForMatch(aadhaar.gender);
  if (leadGender && aadhaarGender && leadGender !== aadhaarGender) {
    return {
      matched: false,
      reason: 'gender_mismatch',
      message: 'Gender on Aadhaar does not match your loan application.',
    };
  }

  // if (!personNamesMatch(leadName, aadhaar.fullName)) {
  //   return {
  //     matched: false,
  //     reason: 'name_mismatch',
  //     message: 'Name on Aadhaar does not match the name on your loan application.',
  //   };
  // }

  return { matched: true };
}

export type AadhaarIdentityFailureDetail = {
  reason: string;
  message: string;
  applicationName: string | null;
  applicationDob: string | null;
  applicationGender: string | null;
  aadhaarName: string | null;
  aadhaarDob: string | null;
  aadhaarGender: string | null;
};

/** Compare Aadhaar vs lead and return both sides so LOS can explain a KYC failure. */
export function describeAadhaarIdentityFailure(input: {
  leadFullName: string | null;
  leadDateOfBirth: Date | null;
  leadGender?: string | null;
  vendor: unknown;
  storedReason?: string | null;
  storedMessage?: string | null;
}): AadhaarIdentityFailureDetail | null {
  const aadhaar = extractAadhaarIdentityFromVendor(input.vendor);
  const match = compareAadhaarToLeadProfile(input);
  if (match.matched && !input.storedReason && !input.storedMessage) {
    return null;
  }
  const reason = !match.matched ? match.reason : (input.storedReason?.trim() || 'identity_mismatch');
  const message = !match.matched
    ? match.message
    : input.storedMessage?.trim() ||
      'Aadhaar was fetched from DigiLocker, but this application was marked KYC failed.';
  return {
    reason,
    message,
    applicationName: input.leadFullName?.trim() || null,
    applicationDob: input.leadDateOfBirth ? dateToUtcYmd(input.leadDateOfBirth) : null,
    applicationGender: input.leadGender?.trim() || null,
    aadhaarName: aadhaar.fullName,
    aadhaarDob: aadhaar.dateOfBirth ? dateToUtcYmd(aadhaar.dateOfBirth) : null,
    aadhaarGender: aadhaar.gender,
  };
}
