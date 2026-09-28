/**
 * "New" vs "Recurring" customer classification — mirrors the backend's `CustomerType` /
 * `CUSTOMER_TYPE` (`backend/src/common/loan/customer-recurring-status.util.ts`). A customer is
 * Recurring only once they have a fully repaid loan under a *different* lead/application/loan than
 * the current row.
 */
export const CUSTOMER_TYPES = ['NEW', 'RECURRING'] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  NEW: 'New',
  RECURRING: 'Recurring',
};

/** `{ value, label }` options for the "Customer type" table filter / grid multi-select. */
export const CUSTOMER_TYPE_FILTER_OPTIONS = CUSTOMER_TYPES.map((value) => ({
  value,
  label: CUSTOMER_TYPE_LABEL[value],
}));
