/**
 * CIBIL / TransUnion account type symbols (Appendix A) classified as unsecured
 * for max open unsecured exposure used in credit-limit tier lookup.
 */
export const CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS = new Set([
  '00', // Other
  '05', // Personal Loan
  '06', // Consumer Loan
  '08', // Education Loan
  '09', // Loan to Professional
  '10', // Credit Card
  '12', // Overdraft
  '16', // Fleet Card
  '36', // Kisan Credit Card
  '37', // Loan on Credit Card
  '38', // PMJDY Overdraft
  '39', // Mudra Loans
  '45', // P2P Personal Loan
  '61', // Business Loan – Unsecured
  '99', // Current Unsecured (portfolio group)
]);

/** Credit card account types use sanctioned limit when available. */
export const CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS = new Set(['10']);
