import { createStore } from 'zustand/vanilla';
import type { CustomerGenderValue, CustomerOccupationValue } from '../customer-details';

export type CustomerOnboardingMode = 'register' | 'login';

export type CustomerOnboardingState = {
  mobileNumber?: string;
  leadUuid?: string;
  email?: string;
  emailVerified?: boolean;
  emailMode?: CustomerOnboardingMode;
  fullName?: string;
  dob?: string;
  addressLine1?: string;
  addressLine2?: string;
  currentCity?: string;
  pincode?: string;
  gender?: CustomerGenderValue;
  occupation?: CustomerOccupationValue;
  monthlyIncome?: string;
  annualTurnover?: string;
  annualProfit?: string;
  incomeAmount?: string;
  creditConsentAccepted?: boolean;
};

type CustomerOnboardingStore = {
  values: CustomerOnboardingState;
  updateValues: (patch: Partial<CustomerOnboardingState>) => void;
  clearValues: () => void;
};

const EMPTY_VALUES: CustomerOnboardingState = {};
const CUSTOMER_ONBOARDING_STORAGE_KEY = 'moneycash.customer.onboarding';

function readStoredValues(): CustomerOnboardingState {
  if (typeof window === 'undefined') {
    return EMPTY_VALUES;
  }

  const storedValue = window.sessionStorage.getItem(CUSTOMER_ONBOARDING_STORAGE_KEY);
  if (!storedValue) {
    return EMPTY_VALUES;
  }

  try {
    const parsed = JSON.parse(storedValue);
    return parsed && typeof parsed === 'object' ? parsed as CustomerOnboardingState : EMPTY_VALUES;
  } catch {
    window.sessionStorage.removeItem(CUSTOMER_ONBOARDING_STORAGE_KEY);
    return EMPTY_VALUES;
  }
}

function persistValues(values: CustomerOnboardingState) {
  if (typeof window === 'undefined') {
    return;
  }

  if (Object.keys(values).length === 0) {
    window.sessionStorage.removeItem(CUSTOMER_ONBOARDING_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(CUSTOMER_ONBOARDING_STORAGE_KEY, JSON.stringify(values));
}

export const customerOnboardingStore = createStore<CustomerOnboardingStore>((set) => ({
  values: readStoredValues(),
  updateValues(patch) {
    set((state) => {
      const nextValues = { ...state.values, ...patch };
      persistValues(nextValues);
      return { values: nextValues };
    });
  },
  clearValues() {
    persistValues(EMPTY_VALUES);
    set({ values: EMPTY_VALUES });
  }
}));

export function readCustomerOnboardingState(): CustomerOnboardingState {
  return customerOnboardingStore.getState().values;
}

export function updateCustomerOnboardingState(patch: Partial<CustomerOnboardingState>): void {
  customerOnboardingStore.getState().updateValues(patch);
}

export function clearCustomerOnboardingState(): void {
  customerOnboardingStore.getState().clearValues();
}

export function getCustomerOnboardingLeadUuid(): string {
  return readCustomerOnboardingState().leadUuid?.trim() ?? '';
}
