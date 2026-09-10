import type { ChangeEvent } from 'react';

export type Fields = {
  fullName: string;
  gender: string;
  dob: string;
  panNumber: string;
  occupation: string;
  addressLine1: string;
  addressLine2: string;
  emailId: string;
  currentCity: string;
  currentCityId: number | null;
  pincode: string;
  monthlyIncome: string;
  annualTurnover: string;
  annualProfit: string;
  creditConsentAccepted: boolean;
};

export type FieldError = Partial<Record<keyof Fields, string>>;

export type SelectOption = { value: string; label: string };

export type OnChange = (
  key: Exclude<keyof Fields, 'creditConsentAccepted'>,
) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
