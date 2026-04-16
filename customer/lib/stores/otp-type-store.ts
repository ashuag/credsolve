export type OtpTypeValue = 'mobile' | 'email';

type OtpTypeStore = {
  values: OtpTypeValue[];
  hasHydrated: boolean;
};

const state: OtpTypeStore = {
  values: [],
  hasHydrated: false
};

export function isOtpTypeValue(value: unknown): value is OtpTypeValue {
  return value === 'mobile' || value === 'email';
}

function normalizeOtpTypeValues(values: OtpTypeValue[]) {
  return Array.from(new Set(values.filter(isOtpTypeValue)));
}

export function hydrateOtpTypeStore() {
  state.hasHydrated = true;
}

export function getOtpTypeValuesSnapshot() {
  hydrateOtpTypeStore();
  return state.values;
}

export function setOtpTypeStoreValues(values: OtpTypeValue[]) {
  state.values = normalizeOtpTypeValues(values);
  state.hasHydrated = true;
}
