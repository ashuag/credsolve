import type { Prisma } from '@prisma/client';

const CRITERIA: Array<{ key: string; label: string; value: string; description: string }> = [
  { key: 'cibil_min_new',           label: 'Min CIBIL score (new customer)',          value: '700',   description: 'Minimum CIBIL Vision Score for first-time borrowers' },
  { key: 'cibil_min_existing',      label: 'Min CIBIL score (existing customer)',     value: '650',   description: 'Minimum CIBIL Vision Score for repeat / existing borrowers' },
  { key: 'cibil_max',               label: 'Max CIBIL score',                         value: '900',   description: 'Maximum CIBIL Vision Score (upper ceiling)' },
  { key: 'ntc_allowed',             label: 'NTC (New to Credit) allowed',             value: 'false', description: 'Whether New-to-Credit customers are eligible (true/false)' },
  { key: 'min_age',                 label: 'Minimum borrower age (years)',            value: '21',    description: 'Customer must be at least this age at loan origination' },
  { key: 'max_age',                 label: 'Maximum borrower age at end of tenure',   value: '58',    description: 'Customer age must not exceed this at end of loan tenure' },
  { key: 'min_loan_amount',         label: 'Minimum loan amount (₹)',                 value: '500',   description: 'Minimum permissible loan request amount in INR' },
  { key: 'max_loan_amount',         label: 'Maximum loan amount (₹)',                 value: '30000', description: 'Maximum permissible loan request amount in INR' },
  { key: 'open_dpd_months',         label: 'No open DPD in last N months',            value: '6',     description: 'Customer must have no open DPD within this many months' },
  { key: 'dpd_30plus_months',       label: 'No 30+ DPD in last N months',             value: '3',     description: 'Customer must have no 30+ DPD within this many months' },
  { key: 'dpd_60plus_months',       label: 'No 60+ DPD in last N months',             value: '9',     description: 'Customer must have no 60+ DPD within this many months' },
  { key: 'dpd_90plus_months',       label: 'No 90+ DPD in last N months',             value: '12',    description: 'Customer must have no 90+ DPD within this many months' },
  { key: 'settled_months',          label: 'No Doubtful/Loss/Written-off/Settled in last N months', value: '18', description: 'No adverse classification in this window' },
  { key: 'no_restructured_loans',   label: 'No restructured loans allowed',           value: 'true',  description: 'Customer must have no restructured loan trades' },
  { key: 'no_sma_pwos',             label: 'No SMA or PWOS trade lines',              value: 'true',  description: 'Customer must have no Special Mention Account or Pre-Written-Off Status trades' },
  { key: 'no_active_mfi',           label: 'No active MFI loans',                    value: 'true',  description: 'Customer must not have an active microfinance loan' },
  { key: 'max_enquiries_30_days',   label: 'Max loan enquiries in last 30 days',      value: '10',    description: 'Customer must have ≤ this many credit enquiries in the past 30 days' },
];

export async function seedEligibilityCriteria(prisma: Prisma.TransactionClient) {
  for (const c of CRITERIA) {
    await prisma.$executeRaw`
      INSERT INTO \`eligibility_criteria\` (\`key\`, \`label\`, \`value\`, \`description\`, \`is_active\`, \`updated_at\`)
      VALUES (${c.key}, ${c.label}, ${c.value}, ${c.description}, 1, NOW(3))
      ON DUPLICATE KEY UPDATE
        \`label\`       = VALUES(\`label\`),
        \`description\` = VALUES(\`description\`),
        \`is_active\`   = 1,
        \`updated_at\`  = NOW(3)
    `;
  }

  console.log('Eligibility criteria seeded');
}
