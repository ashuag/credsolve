export const OCCUPATION = {
  SALARIED: { key: 'SALARIED', name: 'Salaried' },
  SELF_EMPLOYED_PROFESSIONAL: { key: 'SELF_EMPLOYED_PROFESSIONAL', name: 'Self Employed Professional' },
  SELF_EMPLOYED_BUSINESS: { key: 'SELF_EMPLOYED_BUSINESS', name: 'Self Employed Business' },
  STUDENT: { key: 'STUDENT', name: 'Students' },
  HOMEMAKER: { key: 'HOMEMAKER', name: 'Homemaker' },
  RETIRED: { key: 'RETIRED', name: 'Retired' },
  UNEMPLOYED: { key: 'UNEMPLOYED', name: 'Unemployed' },
} as const;

export type OccupationKey = typeof OCCUPATION[keyof typeof OCCUPATION]['key'];
export type Occupation = typeof OCCUPATION[keyof typeof OCCUPATION]['name'];
