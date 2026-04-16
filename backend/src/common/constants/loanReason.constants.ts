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
