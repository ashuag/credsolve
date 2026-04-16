export const GENDER = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHERS: 'Others',
} as const;

export type Gender = typeof GENDER[keyof typeof GENDER];
