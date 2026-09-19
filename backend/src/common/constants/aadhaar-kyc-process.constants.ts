/** Stored on `customer_kyc.aadhaar_kyc_type`. */
export const AADHAAR_KYC_TYPE = {
  DIGILOCKER: 1,
  OTP: 2,
} as const;

export type AadhaarKycType = (typeof AADHAAR_KYC_TYPE)[keyof typeof AADHAAR_KYC_TYPE];

export function isAadhaarKycType(value: unknown): value is AadhaarKycType {
  return value === AADHAAR_KYC_TYPE.DIGILOCKER || value === AADHAAR_KYC_TYPE.OTP;
}

/** Accepts the numeric type or legacy string stamps. */
export function parseAadhaarKycType(value: unknown): AadhaarKycType | null {
  if (isAadhaarKycType(value)) return value;
  if (value === 'DIGILOCKER' || value === 1 || value === '1') return AADHAAR_KYC_TYPE.DIGILOCKER;
  if (value === 'OTP' || value === 2 || value === '2') return AADHAAR_KYC_TYPE.OTP;
  return null;
}

export function aadhaarKycTypeLabel(type: number | string | null | undefined): 'DigiLocker' | 'OTP based' {
  return parseAadhaarKycType(type) === AADHAAR_KYC_TYPE.OTP ? 'OTP based' : 'DigiLocker';
}

/** @deprecated Use AADHAAR_KYC_TYPE */
export const AADHAAR_KYC_PROCESS = {
  DIGILOCKER: AADHAAR_KYC_TYPE.DIGILOCKER,
  OTP: AADHAAR_KYC_TYPE.OTP,
} as const;

/** @deprecated Use AadhaarKycType */
export type AadhaarKycProcess = AadhaarKycType;

/** @deprecated Use isAadhaarKycType */
export const isAadhaarKycProcess = isAadhaarKycType;

/** @deprecated Use aadhaarKycTypeLabel */
export const aadhaarKycProcessLabel = aadhaarKycTypeLabel;
