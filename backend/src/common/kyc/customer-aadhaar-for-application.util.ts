import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { SettingKey } from '../constants/setting.constants';
import { compareAadhaarToLeadProfile } from './aadhaar-lead-identity-match.util';
import { extractDigilockerIdentityMismatch, isDigilockerAadhaarCaptureComplete } from './aadhaar-vendor-parse.util';

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

export function parseKycValidityDays(value: string | null | undefined): number {
  const n = value ? Number.parseInt(value.trim(), 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return Number.parseInt(SettingKey.KYC_VALIDITY_DAYS.default, 10);
}

export function kycValidityCutoff(now: Date, validityDays: number): Date {
  const days = Number.isFinite(validityDays) && validityDays > 0 ? validityDays : parseKycValidityDays(null);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Latest successful Aadhaar for this customer, including captures from prior applications. */
export function pickLatestSuccessfulCustomerAadhaar<T extends CustomerAadhaarBundle>(
  bundles: T[],
): T | null {
  for (const bundle of bundles) {
    if (!isDigilockerAadhaarCaptureComplete(bundle.aadhaarData)) continue;
    if (extractDigilockerIdentityMismatch(bundle.aadhaarData)) continue;
    if (bundle.aadhaarVerifiedAt || bundle.aadhaarData != null || Boolean(bundle.aadhaarPhotoPath?.trim())) {
      return bundle;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isAadhaarReusedFromPrior(formJson: unknown): boolean {
  return isRecord(formJson) && formJson._reusedFromPriorKyc === true;
}

/** Copy prior Aadhaar onto this application and mark it as linked reuse. */
export function markAadhaarReusedFromPrior(
  formJson: unknown,
  priorVerifiedAt?: Date | null,
): Record<string, unknown> {
  const base = isRecord(formJson) ? { ...formJson } : {};
  return {
    ...base,
    _reusedFromPriorKyc: true,
    _reusedFromVerifiedAt: priorVerifiedAt?.toISOString() ?? null,
  };
}

/** LOS display: this application's accepted Aadhaar, else the previous successful capture. */
export function pickCustomerAadhaarForLos<T extends CustomerAadhaarBundle>(
  bundles: T[],
  params: {
    applicationCreatedAt: Date;
    applicationKycStatus?: number | null;
  },
): T | null {
  const applying = pickCustomerAadhaarForApplication(bundles, params);
  if (applying) {
    if (isDigilockerAadhaarCaptureComplete(applying.aadhaarData)) return applying;
    if (extractDigilockerIdentityMismatch(applying.aadhaarData)) return applying;
  }
  return pickLatestSuccessfulCustomerAadhaar(bundles);
}

export function isReusableCustomerAadhaar(
  bundle: CustomerAadhaarBundle | null | undefined,
  params: {
    now?: Date;
    validityDays: number;
    leadFullName?: string | null;
    leadDateOfBirth?: Date | null;
    leadGender?: string | null;
  },
): boolean {
  if (!bundle) return false;
  if (!isDigilockerAadhaarCaptureComplete(bundle.aadhaarData)) return false;
  if (extractDigilockerIdentityMismatch(bundle.aadhaarData)) return false;
  const verifiedAt = bundle.aadhaarVerifiedAt;
  if (!verifiedAt) return false;
  const cutoff = kycValidityCutoff(params.now ?? new Date(), params.validityDays);
  if (verifiedAt.getTime() < cutoff.getTime()) return false;

  if (params.leadDateOfBirth || params.leadGender || params.leadFullName) {
    const match = compareAadhaarToLeadProfile({
      leadFullName: params.leadFullName ?? null,
      leadDateOfBirth: params.leadDateOfBirth ?? null,
      leadGender: params.leadGender,
      vendor: bundle.aadhaarData,
    });
    if (!match.matched && (match.reason === 'dob_mismatch' || match.reason === 'gender_mismatch')) {
      return false;
    }
  }
  return true;
}

/** Session skip: snapshot already applied the validity window; rematch DOB/gender here. */
export function sessionAadhaarAllowsSkip(params: {
  formJson: unknown;
  leadFullName?: string | null;
  leadDateOfBirth?: Date | null;
  leadGender?: string | null;
}): boolean {
  if (!isDigilockerAadhaarCaptureComplete(params.formJson)) return false;
  if (extractDigilockerIdentityMismatch(params.formJson)) return false;
  const match = compareAadhaarToLeadProfile({
    leadFullName: params.leadFullName ?? null,
    leadDateOfBirth: params.leadDateOfBirth ?? null,
    leadGender: params.leadGender,
    vendor: params.formJson,
  });
  return match.matched || (match.reason !== 'dob_mismatch' && match.reason !== 'gender_mismatch');
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
