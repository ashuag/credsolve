const OCCUPATION_NAME_TO_KEY: Record<string, string> = {
  Salaried: 'SALARIED',
  'Self Employed Professional': 'SELF_EMPLOYED_PROFESSIONAL',
  'Self Employed Business': 'SELF_EMPLOYED_BUSINESS',
  Students: 'STUDENT',
  Homemaker: 'HOMEMAKER',
  Retired: 'RETIRED',
  Unemployed: 'UNEMPLOYED',
};

const ANNUAL_METRIC_KEYS = new Set(['SELF_EMPLOYED_PROFESSIONAL', 'SELF_EMPLOYED_BUSINESS']);

const MONTHLY_METRIC_KEYS = new Set(['SALARIED', 'STUDENT', 'HOMEMAKER', 'RETIRED']);

export function resolveOccupationKey(
  occupationKey?: string | null,
  occupationName?: string | null,
): string | undefined {
  if (occupationKey?.trim()) return occupationKey.trim();
  if (!occupationName?.trim()) return undefined;
  return OCCUPATION_NAME_TO_KEY[occupationName.trim()];
}

export function usesAnnualFinancialMetric(occupationKeyOrName?: string) {
  if (!occupationKeyOrName) return false;
  const key = resolveOccupationKey(occupationKeyOrName, occupationKeyOrName) ?? occupationKeyOrName;
  return ANNUAL_METRIC_KEYS.has(key);
}

export function usesMonthlyIncomeMetric(occupationKeyOrName?: string) {
  if (!occupationKeyOrName) return false;
  const key = resolveOccupationKey(occupationKeyOrName, occupationKeyOrName) ?? occupationKeyOrName;
  return MONTHLY_METRIC_KEYS.has(key);
}
