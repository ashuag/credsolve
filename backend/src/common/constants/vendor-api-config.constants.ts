/** Logical API codes registered in `vendor_api_config`. */
export const VENDOR_API_CODE = {
  CIBIL_FETCH: 'cibil_fetch',
  PAN_VERIFY: 'pan_verify',
  /** DigiLocker KYC (`api_code`); pair with {@link VENDOR_API_NAME.KYC_DIGILOCKER}. */
  KYC: 'kyc',
  /** @deprecated Prefer {@link VENDOR_API_CODE.KYC}; kept for older rows/docs. */
  DIGILOCKER: 'digilocker',
  PENNY_DROP: 'penny_drop',
} as const;

export type VendorApiCode = (typeof VENDOR_API_CODE)[keyof typeof VENDOR_API_CODE];

/** Logical `api_name` values used for DigiLocker / other multi-vendor APIs. */
export const VENDOR_API_NAME = {
  KYC_DIGILOCKER: 'kyc_digilocker',
} as const;

export type VendorApiName = (typeof VENDOR_API_NAME)[keyof typeof VENDOR_API_NAME];

/** Row status — LOS switches these on/off. */
export const VENDOR_API_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type VendorApiStatus = (typeof VENDOR_API_STATUS)[keyof typeof VENDOR_API_STATUS];

export function isVendorApiStatus(value: unknown): value is VendorApiStatus {
  return value === VENDOR_API_STATUS.ACTIVE || value === VENDOR_API_STATUS.INACTIVE;
}
