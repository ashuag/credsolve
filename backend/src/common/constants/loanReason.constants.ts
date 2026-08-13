export const LoanReason = {
    EMERGENCY_EXPENSE: 'Emergency Expense',
    APPLIANCE_PURCHASE: 'Appliance Purchase',
    VEHICLE_FINANCING: 'Vehicle Financing',
    WEDDING_EXPENSE: 'Wedding Expense',
    VACATION_GOALS: 'Vacation Goals',
    CREATING_IMPROVING_CREDIT_HISTORY: 'Improving Credit History',
    HOME_RENOVATION: 'Home Renovation',
    FINANCING_NEW_BUSINESS: 'Financing New Business',
    BUSINESS_PURPOSE: 'Business Purpose',
    AGRICULTURE_FINANCE: 'Agriculture Finance',
    MOVING_COST: 'Moving Cost',
    DEBT_CONSOLIDATION: 'Debt Consolidation'
} as const;

export type LoanReason = typeof LoanReason[keyof typeof LoanReason];

/**
 * Customer DLA picker labels (`customer/lib/loan-reasons.ts`). Sanction letter / KFS Field 6
 * must print these verbatim — not the internal `reason_for_loan.name`.
 */
export const LOAN_PURPOSE_DLA_LABEL: Record<string, string> = {
    [LoanReason.EMERGENCY_EXPENSE]: 'Medical',
    [LoanReason.CREATING_IMPROVING_CREDIT_HISTORY]: 'Education',
    [LoanReason.HOME_RENOVATION]: 'Home Repair',
    [LoanReason.VACATION_GOALS]: 'Travel',
    [LoanReason.WEDDING_EXPENSE]: 'Wedding',
    [LoanReason.BUSINESS_PURPOSE]: 'Business',
    [LoanReason.APPLIANCE_PURCHASE]: 'Electronics',
    [LoanReason.DEBT_CONSOLIDATION]: 'Personal',
};

/** Purpose text for the sanction letter: DLA label when known, otherwise the stored name as-is. */
export function sanctionLetterLoanPurpose(reasonName: string | null | undefined): string {
    const trimmed = reasonName?.trim() ?? '';
    if (!trimmed) return '';
    return LOAN_PURPOSE_DLA_LABEL[trimmed] ?? trimmed;
}
