export const GENDER = {
  MALE: { key: 'MALE', name: 'Male' },
  FEMALE: { key: 'FEMALE', name: 'Female' },
  OTHERS: { key: 'OTHERS', name: 'Others' },
} as const;

export type GenderKey = typeof GENDER[keyof typeof GENDER]['key'];
export type Gender = typeof GENDER[keyof typeof GENDER]['name'];

export const GENDER_KEYS = [GENDER.MALE.key, GENDER.FEMALE.key, GENDER.OTHERS.key] as const;
