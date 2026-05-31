export const GENDER = {
  MALE: { key: 'MALE', name: 'Male' },
  FEMALE: { key: 'FEMALE', name: 'Female' },
  OTHERS: { key: 'OTHERS', name: 'Others' },
} as const;

export type GenderKey = typeof GENDER[keyof typeof GENDER]['key'];
export type Gender = typeof GENDER[keyof typeof GENDER]['name'];
