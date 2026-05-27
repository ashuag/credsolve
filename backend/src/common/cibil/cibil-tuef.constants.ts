/**
 * CIBIL TUEF / TransUnion Consumer Credit Information System codes.
 * Reference: TUEF Guide v2.40 (March 28, 2019) — Account Segment (TL), Appendix A & E.
 */

/** TUEF Tag 33 — Written-off and Settled Status (restructured variants). */
export const TUEF_RESTRUCTURED_WRITTEN_OFF_SETTLED_CODES = new Set([
  '00', // Restructured Loan
  '01', // Restructured Loan (Govt. Mandated)
  '10', // Account Purchased and Restructured
  '11', // Restructured due to Natural Calamity
]);

/** TUEF Tag 28/29 — Asset Classification when NDPD is not reported. */
export const TUEF_ASSET_CLASSIFICATION_CODES = {
  STD: 'STD',
  SMA: 'SMA',
  SUB: 'SUB',
  DBT: 'DBT',
  LSS: 'LSS',
  XXX: 'XXX',
} as const;

/** Post-BRE: SMA + PWOS (PWOS appears on some TrueLink feeds; not listed in TUEF AC table). */
export const TUEF_SMA_PWOS_ASSET_CLASSIFICATION_CODES = new Set([
  TUEF_ASSET_CLASSIFICATION_CODES.SMA,
  'SMA0',
  'SMA1',
  'SMA2',
  'PWOS',
]);

/** Appendix A — Microfinance account types (Appendix E: secured). */
export const TUEF_MFI_ACCOUNT_TYPE_SYMBOLS = new Set(['40', '41', '42', '43']);

/**
 * Enquiry purposes excluded from "loan enquiry" count (Appendix A).
 * Credit-card checks and portfolio/locate enquiry types are not loan applications.
 */
export const TUEF_NON_LOAN_ENQUIRY_PURPOSE_CODES = new Set([
  '10', // Credit card
  '88', // Summary report (enquiry purpose only)
  '90', // Account review
  '91', // Retro enquiry
  '92', // Locate plus
  '97', // Adviser liability
  '98', // Secured (portfolio group)
  '99', // Unsecured (portfolio group)
]);

export const TUEF_RESTRUCTURED_STATUS_LABELS: Record<string, string> = {
  '00': 'Restructured Loan',
  '01': 'Restructured Loan (Govt. Mandated)',
  '10': 'Account Purchased and Restructured',
  '11': 'Restructured due to Natural Calamity',
};
