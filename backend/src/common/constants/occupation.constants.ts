export const OCCUPATION = {
    SALARIED: 'Salaried',
    SELF_EMPLOYED_PROFESSIONAL: 'Self Employed Professional',
    SELF_EMPLOYED_BUSINESS: 'Self Employed Business',
    STUDENT: 'Students',
    HOMEMAKER: 'Homemaker',
    RETIRED: 'Retired',
    UNEMPLOYED: 'Unemployed',
} as const;

export type Occupation = typeof OCCUPATION[keyof typeof OCCUPATION];
