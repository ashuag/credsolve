export const CUSTOMER_TYPE = {
  NEW: 'NEW',
  RECURRING: 'RECURRING',
} as const;

export type CustomerType = (typeof CUSTOMER_TYPE)[keyof typeof CUSTOMER_TYPE];

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  [CUSTOMER_TYPE.NEW]: 'New',
  [CUSTOMER_TYPE.RECURRING]: 'Recurring',
};
