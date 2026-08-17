const OCCUPATION_NAME_TO_KEY: Record<string, string> = {
  Salaried: 'SALARIED',
  'Self Employed Professional': 'SELF_EMPLOYED_PROFESSIONAL',
  'Self Employed Business': 'SELF_EMPLOYED_BUSINESS',
  Students: 'STUDENT',
  Homemaker: 'HOMEMAKER',
  Retired: 'RETIRED',
  Unemployed: 'UNEMPLOYED',
};

export function resolveOccupationKey(
  occupationKey?: string | null,
  occupationName?: string | null,
): string | undefined {
  if (occupationKey?.trim()) return occupationKey.trim();
  if (!occupationName?.trim()) return undefined;
  return OCCUPATION_NAME_TO_KEY[occupationName.trim()];
}

export function usesAnnualFinancialMetric(_occupationKeyOrName?: string) {
  return false;
}

export function usesMonthlyIncomeMetric(occupationKeyOrName?: string) {
  return Boolean(occupationKeyOrName?.trim());
}
