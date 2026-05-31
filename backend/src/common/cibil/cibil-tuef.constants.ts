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

/** TUEF Tag 33 — non-restructure written-off / settled / sold statuses (post-BRE adverse tradeline). */
export const TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_CODES = new Set([
  '02', // Written-off
  '03', // Settled
  '04', // Post (WO) Settled
  '05', // Account Sold
  '06', // Written Off and Account Sold
  '07', // Account Purchased
  '08', // Account Purchased and Written Off
  '09', // Account Purchased and Settled
]);

export const TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_LABELS: Record<string, string> = {
  '02': 'Written-off',
  '03': 'Settled',
  '04': 'Post (WO) Settled',
  '05': 'Account Sold',
  '06': 'Written Off and Account Sold',
  '07': 'Account Purchased',
  '08': 'Account Purchased and Written Off',
  '09': 'Account Purchased and Settled',
};

/**
 * Credit Facility Status strings that indicate a moratorium / regulatory restructure.
 * These appear as text values (not TUEF codes) in the CreditFacilityStatus or similar fields
 * on TrueLink bureau payloads — e.g. "Moratorium (Regulatory Measures)".
 */
export const MORATORIUM_CREDIT_FACILITY_KEYWORDS = [
  'MORATORIUM',
  'REGULATORY MEASURE',
  'COVID',
];

/** TUEF Tag 34 — Suit Filed / Wilful Default Status (01–03 are adverse). */
export const TUEF_SUIT_FILED_WILFUL_DEFAULT_CODES = {
  NONE: '00',
  SUIT_FILED: '01',
  WILFUL_DEFAULT: '02',
  SUIT_FILED_WILFUL_DEFAULT: '03',
} as const;

export const TUEF_ADVERSE_SUIT_FILED_WILFUL_DEFAULT_CODES = new Set<string>([
  TUEF_SUIT_FILED_WILFUL_DEFAULT_CODES.SUIT_FILED,
  TUEF_SUIT_FILED_WILFUL_DEFAULT_CODES.WILFUL_DEFAULT,
  TUEF_SUIT_FILED_WILFUL_DEFAULT_CODES.SUIT_FILED_WILFUL_DEFAULT,
]);

export const TUEF_SUIT_FILED_WILFUL_DEFAULT_LABELS: Record<string, string> = {
  '00': 'No suit filed',
  '01': 'Suit filed',
  '02': 'Wilful default',
  '03': 'Suit filed (Wilful default)',
};
