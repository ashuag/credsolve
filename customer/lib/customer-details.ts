export type CustomerGenderValue = 'male' | 'female' | 'others';

export type CustomerOccupationValue =
  | 'salaried'
  | 'self_employed_professional'
  | 'self_employed_business'
  | 'student'
  | 'homemaker'
  | 'retired';

export type CustomerLookupOption<T extends string> = {
  value: T;
  label: string;
};

export const CUSTOMER_GENDER_OPTIONS: Array<CustomerLookupOption<CustomerGenderValue>> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'others', label: 'Others' }
];

export const CUSTOMER_OCCUPATION_OPTIONS: Array<CustomerLookupOption<CustomerOccupationValue>> = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed_professional', label: 'Self employed professional' },
  { value: 'self_employed_business', label: 'Self employed business' },
  { value: 'student', label: 'Students' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'retired', label: 'Retired' }
];

const GENDER_LOOKUP_NAME_TO_VALUE: Record<string, CustomerGenderValue> = {
  male: 'male',
  female: 'female',
  others: 'others'
};

const OCCUPATION_LOOKUP_NAME_TO_VALUE: Record<string, CustomerOccupationValue> = {
  salaried: 'salaried',
  'self employed professional': 'self_employed_professional',
  'self employed business': 'self_employed_business',
  students: 'student',
  homemaker: 'homemaker',
  retired: 'retired'
};

export const CUSTOMER_CREDIT_CONSENT_TEXT =
  "I accept the T&C's of TU CIBIL and authorize MoneyCash to check my CIBIL Score & Report. I consent to MoneyCash app's lenders/lending partners retrieving my CKYC records, accessing my CIBIL profile, and conducting credit checks to assign my credit limit.";

function normalizeLookupName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mapLookupNameToOption<T extends string>(
  name: string,
  valueMap: Record<string, T>,
  fallbackOptions: Array<CustomerLookupOption<T>>
): CustomerLookupOption<T> | null {
  const value = valueMap[normalizeLookupName(name)];

  if (!value) {
    return null;
  }

  const fallbackLabel = fallbackOptions.find((option) => option.value === value)?.label ?? name.trim();

  return {
    value,
    label: name.trim() || fallbackLabel
  };
}

export function mapGenderLookupNameToOption(name: string) {
  return mapLookupNameToOption(name, GENDER_LOOKUP_NAME_TO_VALUE, CUSTOMER_GENDER_OPTIONS);
}

export function mapOccupationLookupNameToOption(name: string) {
  return mapLookupNameToOption(name, OCCUPATION_LOOKUP_NAME_TO_VALUE, CUSTOMER_OCCUPATION_OPTIONS);
}

export function usesAnnualFinancialMetric(occupation?: CustomerOccupationValue) {
  return occupation === 'self_employed_professional' || occupation === 'self_employed_business';
}

export function usesMonthlyIncomeMetric(occupation?: CustomerOccupationValue) {
  return occupation === 'salaried' || occupation === 'student' || occupation === 'homemaker' || occupation === 'retired';
}

export function getFinancialMetricLabel(occupation?: CustomerOccupationValue) {
  if (usesAnnualFinancialMetric(occupation)) {
    return 'Annual turnover / annual profit';
  }

  if (usesMonthlyIncomeMetric(occupation)) {
    return 'Monthly income';
  }

  return 'Income details';
}

export function getFinancialMetricHelp(occupation?: CustomerOccupationValue) {
  if (usesAnnualFinancialMetric(occupation)) {
    return 'Share your latest annual turnover and annual profit in INR.';
  }

  if (usesMonthlyIncomeMetric(occupation)) {
    return 'Share your current take-home monthly income in INR.';
  }

  return 'Share your income details if applicable.';
}
