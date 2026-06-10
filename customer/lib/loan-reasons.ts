/** Must match active `reason_for_loan.name` rows seeded from backend `LoanReason` constants. */
export type CustomerLoanPurposeOption = {
  /** Stored in `application_detail.reason_for_loan_id` via exact name lookup. */
  value: string;
  /** Short label shown in the customer picker. */
  label: string;
  icon: string;
};

export const CUSTOMER_LOAN_PURPOSE_OPTIONS: CustomerLoanPurposeOption[] = [
  { value: 'Emergency Expense', label: 'Medical', icon: '🏥' },
  { value: 'Improving Credit History', label: 'Education', icon: '🎓' },
  { value: 'Home Renovation', label: 'Home Repair', icon: '🏠' },
  { value: 'Vacation Goals', label: 'Travel', icon: '✈️' },
  { value: 'Wedding Expense', label: 'Wedding', icon: '💍' },
  { value: 'Business Purpose', label: 'Business', icon: '💼' },
  { value: 'Appliance Purchase', label: 'Electronics', icon: '📱' },
  { value: 'Debt Consolidation', label: 'Personal', icon: '💳' },
];
