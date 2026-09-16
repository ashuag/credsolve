import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { isDigilockerAadhaarCaptureComplete } from './aadhaar-vendor-parse.util';

export type CustomerAadhaarBundle = {
  aadhaarVerifiedAt?: Date | null;
  aadhaarData?: unknown;
  aadhaarPhotoPath?: string | null;
};

/**
 * Aadhaar lives on `customer_kyc` (shared across applications). After a rejected
 * lead is replaced, the previous bundle must not count as DigiLocker complete.
 */
export function customerAadhaarAppliesToApplication(
  bundle: CustomerAadhaarBundle | null | undefined,
  params: {
    applicationCreatedAt: Date;
    applicationKycStatus?: number | null;
  },
): boolean {
  if (!bundle) return false;
  const verifiedAt = bundle.aadhaarVerifiedAt;
  if (verifiedAt && verifiedAt.getTime() >= params.applicationCreatedAt.getTime()) {
    return true;
  }
  if (params.applicationKycStatus !== APPLICATION_KYC_STATUS.FAILED) return false;
  return bundle.aadhaarData != null || Boolean(bundle.aadhaarPhotoPath?.trim());
}

export function pickCustomerAadhaarForApplication<T extends CustomerAadhaarBundle>(
  bundles: T[],
  params: {
    applicationCreatedAt: Date;
    applicationKycStatus?: number | null;
  },
): T | null {
  for (const bundle of bundles) {
    if (customerAadhaarAppliesToApplication(bundle, params)) return bundle;
  }
  return null;
}

/** True when writing DigiLocker artifacts would overwrite a prior application's Aadhaar. */
export function shouldStartNewCustomerKycBundle(
  latest: CustomerAadhaarBundle | null | undefined,
  params: {
    applicationCreatedAt: Date;
    applicationKycStatus?: number | null;
  },
): boolean {
  if (!latest) return false;
  if (customerAadhaarAppliesToApplication(latest, params)) return false;
  return (
    Boolean(latest.aadhaarVerifiedAt) ||
    latest.aadhaarData != null ||
    Boolean(latest.aadhaarPhotoPath?.trim()) ||
    isDigilockerAadhaarCaptureComplete(latest.aadhaarData)
  );
}
