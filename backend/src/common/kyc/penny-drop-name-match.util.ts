import { personNamesMatch } from './aadhaar-lead-identity-match.util';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

const BANK_NAME_KEYS = [
  'name_at_bank',
  'nameAtBank',
  'nameAsPerBank',
  'name_as_per_bank',
  'accountHolderName',
  'account_holder_name',
  'beneficiaryName',
  'beneficiary_name',
  'registeredName',
  'registered_name',
  'accountName',
  'account_name',
  'bankAccountName',
  'bank_account_name',
  'holderName',
  'holder_name',
  'fullName',
  'full_name',
  'name',
] as const;

/**
 * Best-effort account-holder name from a Tenacio / Sandbox-style penny-drop envelope.
 * Prefers nested `data` / `output`, then root.
 */
export function extractPennyDropBankName(vendor: unknown): string | null {
  if (!isRecord(vendor)) return null;

  const bags: Record<string, unknown>[] = [];
  if (isRecord(vendor.data)) bags.push(vendor.data);
  if (isRecord(vendor.output)) bags.push(vendor.output);
  bags.push(vendor);

  for (const bag of bags) {
    const direct = pickString(bag, [...BANK_NAME_KEYS]);
    if (direct) return direct;

    const nameInfo = bag.name_information ?? bag.nameInformation;
    if (isRecord(nameInfo)) {
      const nested = pickString(nameInfo, [
        'name_at_bank',
        'nameAtBank',
        'name_at_bank_cleaned',
        'nameAtBankCleaned',
        'name',
      ]);
      if (nested) return nested;
    }
  }

  return null;
}

/** Vendor-provided name match flag when present (`nameMatch`, `name_match`, etc.). */
export function extractPennyDropNameMatchFlag(vendor: unknown): boolean | null {
  if (!isRecord(vendor)) return null;

  const bags: Record<string, unknown>[] = [];
  if (isRecord(vendor.data)) bags.push(vendor.data);
  if (isRecord(vendor.output)) bags.push(vendor.output);
  bags.push(vendor);

  for (const bag of bags) {
    for (const key of ['nameMatch', 'name_match', 'isNameMatch', 'is_name_match', 'nameMatched'] as const) {
      const v = bag[key];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'match', 'matched'].includes(lower)) return true;
        if (['false', 'no', 'n', '0', 'mismatch', 'not_match', 'unmatched'].includes(lower)) return false;
      }
    }
  }
  return null;
}

export type PennyDropNameMatchResult =
  | { matched: true; bankName: string | null }
  | {
      matched: false;
      reason: 'missing_journey_name' | 'missing_bank_name' | 'vendor_name_mismatch' | 'name_mismatch';
      message: string;
      bankName: string | null;
    };

/**
 * After a successful penny-drop call, ensure the journey name matches the bank-returned name.
 */
export function compareJourneyNameToPennyDrop(input: {
  journeyFullName: string | null | undefined;
  vendor: unknown;
}): PennyDropNameMatchResult {
  const journeyName = input.journeyFullName?.trim() ?? '';
  if (!journeyName) {
    return {
      matched: false,
      reason: 'missing_journey_name',
      message: 'Complete your full name in personal details before submitting bank information.',
      bankName: null,
    };
  }

  const vendorFlag = extractPennyDropNameMatchFlag(input.vendor);
  const bankName = extractPennyDropBankName(input.vendor);

  if (vendorFlag === false) {
    return {
      matched: false,
      reason: 'vendor_name_mismatch',
      message:
        'The name on your bank account does not match the name on your loan application. Please use an account in your name.',
      bankName,
    };
  }

  if (!bankName) {
    // Vendor already affirmed nameMatch — allow when name string is absent.
    if (vendorFlag === true) {
      return { matched: true, bankName: null };
    }
    return {
      matched: false,
      reason: 'missing_bank_name',
      message:
        'Bank verification did not return the account holder name. Please try again or contact support.',
      bankName: null,
    };
  }

  if (!personNamesMatch(journeyName, bankName)) {
    return {
      matched: false,
      reason: 'name_mismatch',
      message:
        'The name on your bank account does not match the name on your loan application. Please use an account in your name.',
      bankName,
    };
  }

  return { matched: true, bankName };
}
