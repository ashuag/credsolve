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


export const TUEF_RESTRUCTURED_STATUS_LABELS: Record<string, string> = {
  '00': 'Restructured Loan',
  '01': 'Restructured Loan (Govt. Mandated)',
  '10': 'Account Purchased and Restructured',
  '11': 'Restructured due to Natural Calamity',
};

/**
 * TUEF Tag 33 — non-restructure written-off / settled statuses (post-BRE adverse tradeline).
 * Codes 05 (Account Sold) and 07 (Account Purchased) are portfolio-transfer markers and are
 * excluded — they are not write-offs on their own (see 06/08/09 for combined adverse states).
 */
export const TUEF_ADVERSE_WRITTEN_OFF_SETTLED_STATUS_CODES = new Set([
  '02', // Written-off
  '03', // Settled
  '04', // Post (WO) Settled
  '06', // Written Off and Account Sold
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

/** TUEF Tag 34 — Suit Filed / Wilful Default Status (01-03 are adverse). */
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


// Enquiry purpose codes that are NOT loan enquiries (credit card, portfolio review, retro)
export const TUEF_NON_LOAN_ENQUIRY_PURPOSE_CODES = new Set(['10', '90', '91']);

/** Payment-history / asset-classification markers that fail "no DBT/LSS/SUB/settled" rules. */
export const ADVERSE_PAY_STATUS_CODES = new Set(['SUB', 'DBT', 'LSS', 'LOSS', 'SMA', 'PWOS', 'WOFF', 'WO', 'WRITTEN', 'WRITTENOFF', 'RGM', 'RCV', 'DEV', 'SPM', 'SF', 'SUITFILED', 'WD', 'WILFULDEFAULT', 'POSTWO', 'POSTWOS', 'RES', 'RESTRUCTURED', 'OTS', 'SETTLEMENT']);

export const NEUTRAL_PAY_STATUS_CODES = new Set(['0', '00', '000', 'STD', 'XXX', 'CLSD', 'CLOSED', '-1', '-2']);


export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  '01': 'Auto loan (Personal)',
  '02': 'Housing loan',
  '03': 'Property loan',
  '04': 'Loan against property',
  '05': 'Personal loan',
  '06': 'Consumer loan',
  '07': 'Gold loan',
  '08': 'Education loan',
  '09': 'Loan to professional',
  '10': 'Credit card',
  '11': 'Lease',
  '12': 'Overdraft',
  '13': 'Two-wheeler loan',
  '14': 'Non-funded credit facility',
  '15': 'Loan against bank deposits',
  '16': 'Fleet card',
  '17': 'Commercial vehicle loan',
  '18': 'Telco - Wireless',
  '19': 'Telco - Broadband',
  '20': 'Telco - Landline',
  '31': 'Secured Credit Card',
  '32': 'Used Car Loan',
  '33': 'Construction Equipment Loan',
  '34': 'Tractor Loan',
  '35': 'Corporate Credit Card',
  '36': 'Kisan Credit Card',
  '37': 'Loan on Credit Card',
  '38': 'Prime Minister Jaan Dhan Yojana - Overdraft',
  '39': 'Mudra Loans - Shishu / Kishor / Tarun',
  '40': 'Microfinance - Business Loan',
  '41': 'Microfinance - Personal Loan',
  '42': 'Microfinance - Housing Loan',
  '43': 'Microfinance - Other',
  '44': 'Pradhan Mantri Awas Yojana - Credit Link Subsidy',
  '45': 'P2P Personal Loan',
  '46': 'P2P Auto Loan',
  '47': 'P2P Education Loan',
  '50': 'Business Loan - Secured',
  '51': 'Business Loan - General',
  '52': 'Business Loan - Priority Sector - Small Business',
  '53': 'Business Loan - Priority Sector - Agriculture',
  '54': 'Business Loan - Priority Sector - Others',
  '55': 'Business Non-Funded Credit Facility - General',
  '56': 'Business Non-Funded Credit Facility - Priority Sector',
  '57': 'Business Non-Funded Credit Facility - Priority Sector - Agriculture',
  '58': 'Business Non-Funded Credit Facility - Priority Sector - Others',
  '59': 'Business Loan Against Bank Deposits',
  '61': 'Business Loan - Unsecured',
  '69': 'Short Term Personal Loan',
  '80': 'Microfinance Detailed Report',
  '81': 'Summary Report (Applicable to Enquiry Purpose only)',
  '88': 'Locate Plus for Insurance (Applicable to Enquiry Purpose only)',
  '90': 'Account Review (Applicable to Enquiry Purpose only)',
  '91': 'Retro Enquiry (Applicable to Enquiry Purpose only)',
  '92': 'Locate Plus (Applicable to Enquiry Purpose only)',
  '97': 'Adviser Liability (Applicable to Enquiry Purpose only)',
  '00': 'Other',
  '98': 'Secured (Account Group for Portfolio Review response)',
  '99': 'Unsecured (Account Group for Portfolio Review response)',
};


export const DWELLING_LABELS: Record<string, string> = {
  '01': 'Permanent address',
  '02': 'Residence address',
  '03': 'Office address',
  '04': 'Not categorized',
};

export const PHONE_TYPE_LABELS: Record<string, string> = {
  '01': 'Mobile phone',
  '02': 'Office phone',
  '03': 'Home phone',
};

export const CIBIL_UNSECURED_ACCOUNT_TYPE_SYMBOLS = new Set([
  '00', // Other
  '05', // Personal Loan
  '06', // Consumer Loan
  '08', // Education Loan
  '09', // Loan to Professional
  '10', // Credit Card
  '12', // Overdraft
  '16', // Fleet Card
  '37', // Loan on Credit Card
  '38', // PMJDY Overdraft
  '39', // Mudra Loans
  '40', // Microfinance – Unsecured
  '41', // Microfinance – Unsecured (Govt. Mandated)
  '42', // Microfinance – Unsecured (Other)
  '43', // Microfinance – Unsecured (Other, Govt. Mandated)
  '45', // P2P Personal Loan
  '46', // P2P Business Loan
  '47', // P2P Consumer Loan
  '51', // Business Loan – Secured
  '61', // Business Loan – Unsecured
  '69', // Short Term Personal Loan
  '99', // Current Unsecured (portfolio group)
]);

/** Credit card account types use sanctioned limit when available. */
export const CIBIL_CREDIT_CARD_ACCOUNT_TYPE_SYMBOLS = new Set(['10']);

