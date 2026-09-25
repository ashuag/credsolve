/** CredSolve brand — separate from MoneyCash. */
export const BRAND = {
  name: 'CredSolve',
  legalName: 'CredSolve Technologies Private Limited',
  tagline: 'Credit Made Easy',
  /** Primary accent (lime) — CTAs, checks, success. */
  accent: '#22C55E',
  accentDeep: '#16A34A',
  /** Supporting blue. */
  blue: '#2388E5',
  blueLight: '#4DB3FF',
  /** Core navy. */
  navy: '#0F2748',
  navyDeep: '#0A1B33',
  text: '#0F2748',
  muted: '#5E6782',
  email: 'hello@credsolve.in',
  grievanceEmail: 'grievance@credsolve.in',
  phoneDisplay: '+91 [phone]',
  address:
    'Ghaziabad, Uttar Pradesh',
} as const;

export const BRAND_NAME = BRAND.name;
export const BRAND_TAGLINE = BRAND.tagline;

export const BRAND_TRUST_STRIP = [
  'Loans by RBI-registered NBFC partners',
  '100% paperless with PAN & Aadhaar',
  'Decision in minutes',
  'No charges before disbursal',
] as const;

export const BRAND_VALUE_PILLS = [
  'Up to ₹2,00,000',
  'Approval in minutes',
  '100% paperless',
  'No charges before disbursal',
] as const;

export const MAX_LOAN_DISPLAY = '₹2,00,000';

/** LSP disclaimer for footers (CredSolve is not the lender). */
export const BRAND_LSP_DISCLAIMER =
  'CredSolve is a Lending Service Provider (LSP). Credit is sanctioned and disbursed solely by regulated NBFC / bank partners. CredSolve does not lend on its own balance sheet or hold borrower funds.';
