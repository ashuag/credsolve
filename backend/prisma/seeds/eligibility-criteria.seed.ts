import type { Prisma } from '@prisma/client';

const PRE_BRE = 'PRE_BRE';
const POST_BRE = 'POST_BRE';

const CRITERIA: Array<{ key: string; label: string; value: string; breType: string; description: string }> = [
  { key: 'MIN_LOAN_AMOUNT', label: 'Minimum loan amount (₹)', value: '500', breType: PRE_BRE, description: 'Minimum permissible loan request amount in INR' },
  { key: 'MAX_LOAN_AMOUNT', label: 'Maximum loan amount (₹)', value: '30000', breType: PRE_BRE, description: 'Maximum permissible loan request amount in INR' },
  { key: 'MIN_AGE', label: 'Minimum borrower age (years)', value: '21', breType: PRE_BRE, description: 'Customer must be at least this age at loan origination' },
  { key: 'MAX_AGE', label: 'Maximum borrower age at end of tenure', value: '58', breType: PRE_BRE, description: 'Customer completed age must be less than this at end of loan tenure' },
  { key: 'ENFORCE_NEGATIVE_STATE', label: 'Enforce negative state list', value: 'true', breType: PRE_BRE, description: 'When true, origination is blocked when the customer address maps to a state present in the negative_state serviceability master.' },
  { key: 'ENFORCE_NEGATIVE_PINCODE', label: 'Enforce negative pincode list', value: 'true', breType: PRE_BRE, description: 'When true, origination is blocked when the customer pincode matches an active row in the negative_pincode serviceability master.' },
  { key: 'ENFORCE_NEGATIVE_CITY', label: 'Enforce negative city list', value: 'true', breType: PRE_BRE, description: 'When true, origination is blocked when the customer city matches an active row in the negative_city serviceability master.' },
  { key: 'REJECTED_OCCUPATIONS', label: 'Rejected occupations', value: 'STUDENT,HOMEMAKER,RETIRED', breType: PRE_BRE, description: 'Comma-separated list of occupation keys blocked from origination' },
  { key: 'REJECTED_GENDERS', label: 'Rejected genders', value: 'OTHERS', breType: PRE_BRE, description: 'Comma-separated list of gender keys blocked from origination' },
  { key: 'CIBIL_MIN_NEW', label: 'Min CIBIL score (new customer)', value: '700', breType: POST_BRE, description: 'Minimum CIBIL Vision Score for first-time borrowers' },
  { key: 'CIBIL_MIN_EXISTING', label: 'Min CIBIL score (existing customer)', value: '650', breType: POST_BRE, description: 'Minimum CIBIL Vision Score for repeat / existing borrowers' },
  { key: 'CIBIL_MAX', label: 'Max CIBIL score', value: '900', breType: POST_BRE, description: 'Maximum CIBIL Vision Score (upper ceiling)' },
  { key: 'NTC_ALLOWED', label: 'NTC (New to Credit) allowed', value: 'false', breType: POST_BRE, description: 'Whether New-to-Credit customers are eligible (true/false)' },
  { key: 'OPEN_DPD_MONTHS', label: 'No open DPD in last N months', value: '6', breType: POST_BRE, description: 'Customer must have no open DPD within this many months' },
  { key: 'DPD_30PLUS_MONTHS', label: 'No 30+ DPD in last N months', value: '3', breType: POST_BRE, description: 'Customer must have no 30+ DPD within this many months' },
  { key: 'DPD_60PLUS_MONTHS', label: 'No 60+ DPD in last N months', value: '9', breType: POST_BRE, description: 'Customer must have no 60+ DPD within this many months' },
  { key: 'DPD_90PLUS_MONTHS', label: 'No 90+ DPD in last N months', value: '12', breType: POST_BRE, description: 'Customer must have no 90+ DPD within this many months' },
  { key: 'SETTLED_MONTHS', label: 'No Doubtful/Loss/Written-off/Settled in last N months', value: '18', breType: POST_BRE, description: 'No adverse classification in this window' },
  { key: 'NO_RESTRUCTURED_LOANS', label: 'No restructured loans allowed', value: 'true', breType: POST_BRE, description: 'Customer must have no restructured loan trades' },
  { key: 'NO_SMA_PWOS', label: 'No SMA or PWOS trade lines', value: 'true', breType: POST_BRE, description: 'Customer must have no Special Mention Account or Pre-Written-Off Status trades' },
  { key: 'NO_ACTIVE_MFI', label: 'No active MFI loans', value: 'true', breType: POST_BRE, description: 'Customer must not have an active microfinance loan' },
  { key: 'MAX_ENQUIRIES_30_DAYS', label: 'Max loan enquiries in last 30 days', value: '10', breType: POST_BRE, description: 'Customer must have ≤ this many credit enquiries in the past 30 days' },
  { key: 'MAX_MISSED_PAYMENTS_6_MONTHS', label: 'Max missed payments in last 6 months', value: '1', breType: POST_BRE, description: 'Customer must have ≤ this many months with any DPD > 0 across all tradelines in the past 6 months' },
  { key: 'MIN_UNSECURED_LOAN_AMOUNT', label: 'Min total unsecured loan amount (₹)', value: '20000', breType: POST_BRE, description: 'Post-BRE rejects when the sum of unsecured tradeline exposure (open + closed) is below this INR amount' },
  { key: 'MAX_LOAN_TYPE_OVERDUE_AMOUNT', label: 'Max overdue amount per loan type (₹)', value: '0', breType: POST_BRE, description: 'Post-BRE rejects when any CIBIL loan/account type has overdue (amount past due) greater than this INR amount' },
  { key: 'REJECT_OPEN_LOAN_TYPES', label: 'Reject open loan type', value: '', breType: POST_BRE, description: 'Comma-separated CIBIL loan type IDs (TUEF account types). Post-BRE rejects when any matching tradeline exists and is open' },
  { key: 'REJECT_LOAN_TYPES', label: 'Reject if loan type', value: '', breType: POST_BRE, description: 'Comma-separated CIBIL loan type IDs (TUEF account types). Post-BRE rejects when any matching tradeline exists (open or closed)' },
  { key: 'REJECTED_CREDIT_ASSESSMENT_GRADES_NEW', label: 'Rejected credit assessment grades (new customers)', value: 'E,F,G,H', breType: POST_BRE, description: 'Comma-separated list of CIBIL credit-assessment grades (A–H) that fail post-BRE for new customers' },
  { key: 'REJECTED_CREDIT_ASSESSMENT_GRADES_EXISTING', label: 'Rejected credit assessment grades (recurring customers)', value: 'E,F,G,H', breType: POST_BRE, description: 'Comma-separated list of CIBIL credit-assessment grades (A–H) that fail post-BRE for recurring customers' },
];

export async function seedEligibilityCriteria(prisma: Prisma.TransactionClient) {
  for (const c of CRITERIA) {
    await prisma.eligibilityCriteria.upsert({
      where: { key: c.key },
      create: {
        key: c.key,
        label: c.label,
        value: c.value,
        breType: c.breType,
        description: c.description,
        isActive: true,
      },
      update: {
        label: c.label,
        breType: c.breType,
        description: c.description,
        isActive: true,
      },
    });
  }

  console.log('Eligibility criteria seeded');
}
