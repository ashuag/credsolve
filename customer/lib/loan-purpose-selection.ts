import { CUSTOMER_LOAN_PURPOSE_OPTIONS } from './loan-reasons';

export const LOAN_PURPOSE_QUERY_KEY = 'loanPurpose';
export const LOAN_PURPOSE_STORAGE_KEY = 'mc:selected-loan-purpose';

/** Landing product id → backend `reason_for_loan.name` (must match `CUSTOMER_LOAN_PURPOSE_OPTIONS`). */
export const LANDING_LOAN_PRODUCT_PURPOSE: Record<string, string> = {
  payday: 'Debt Consolidation',
  emergency: 'Emergency Expense',
  medical: 'Emergency Expense',
  education: 'Improving Credit History',
};

const VALID_LOAN_PURPOSES = new Set(CUSTOMER_LOAN_PURPOSE_OPTIONS.map((option) => option.value));

export function isValidLoanPurpose(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && VALID_LOAN_PURPOSES.has(value.trim()));
}

export function resolveLandingLoanPurpose(productId: string): string | null {
  const mapped = LANDING_LOAN_PRODUCT_PURPOSE[productId]?.trim();
  return isValidLoanPurpose(mapped) ? mapped : null;
}

export function storeLoanPurpose(value: string) {
  if (typeof window === 'undefined' || !isValidLoanPurpose(value)) {
    return;
  }

  try {
    sessionStorage.setItem(LOAN_PURPOSE_STORAGE_KEY, value.trim());
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredLoanPurpose(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = sessionStorage.getItem(LOAN_PURPOSE_STORAGE_KEY)?.trim();
    return isValidLoanPurpose(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearStoredLoanPurpose() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(LOAN_PURPOSE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function captureLoanPurposeFromSearch(search: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const value = new URLSearchParams(search).get(LOAN_PURPOSE_QUERY_KEY)?.trim();
  if (!isValidLoanPurpose(value)) {
    return;
  }

  storeLoanPurpose(value);
}
