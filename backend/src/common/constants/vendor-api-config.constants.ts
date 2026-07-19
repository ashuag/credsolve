/** Logical API codes registered in `vendor_api_config`. */
export const VENDOR_API_CODE = {
  CIBIL_FETCH: 'cibil_fetch',
  PAN_VERIFY: 'pan_verify',
  DIGILOCKER: 'digilocker',
  PENNY_DROP: 'penny_drop',
} as const;

export type VendorApiCode = (typeof VENDOR_API_CODE)[keyof typeof VENDOR_API_CODE];

/** Row status — LOS switches these on/off. */
export const VENDOR_API_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type VendorApiStatus = (typeof VENDOR_API_STATUS)[keyof typeof VENDOR_API_STATUS];

export function isVendorApiStatus(value: unknown): value is VendorApiStatus {
  return value === VENDOR_API_STATUS.ACTIVE || value === VENDOR_API_STATUS.INACTIVE;
}
