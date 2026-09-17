/** TUEF Appendix A tradeline account types (enquiry-only codes omitted). */
export const CIBIL_TRADELINE_ACCOUNT_TYPES: { id: string; label: string }[] = [
  { id: '01', label: 'Auto loan (Personal)' },
  { id: '02', label: 'Housing loan' },
  { id: '03', label: 'Property loan' },
  { id: '04', label: 'Loan against property' },
  { id: '05', label: 'Personal loan' },
  { id: '06', label: 'Consumer loan' },
  { id: '07', label: 'Gold loan' },
  { id: '08', label: 'Education loan' },
  { id: '09', label: 'Loan to professional' },
  { id: '10', label: 'Credit card' },
  { id: '11', label: 'Lease' },
  { id: '12', label: 'Overdraft' },
  { id: '13', label: 'Two-wheeler loan' },
  { id: '14', label: 'Non-funded credit facility' },
  { id: '15', label: 'Loan against bank deposits' },
  { id: '16', label: 'Fleet card' },
  { id: '17', label: 'Commercial vehicle loan' },
  { id: '18', label: 'Telco - Wireless' },
  { id: '19', label: 'Telco - Broadband' },
  { id: '20', label: 'Telco - Landline' },
  { id: '31', label: 'Secured Credit Card' },
  { id: '32', label: 'Used Car Loan' },
  { id: '33', label: 'Construction Equipment Loan' },
  { id: '34', label: 'Tractor Loan' },
  { id: '35', label: 'Corporate Credit Card' },
  { id: '36', label: 'Kisan Credit Card' },
  { id: '37', label: 'Loan on Credit Card' },
  { id: '38', label: 'Prime Minister Jaan Dhan Yojana - Overdraft' },
  { id: '39', label: 'Mudra Loans - Shishu / Kishor / Tarun' },
  { id: '40', label: 'Microfinance - Business Loan' },
  { id: '41', label: 'Microfinance - Personal Loan' },
  { id: '42', label: 'Microfinance - Housing Loan' },
  { id: '43', label: 'Microfinance - Other' },
  { id: '44', label: 'Pradhan Mantri Awas Yojana - Credit Link Subsidy' },
  { id: '45', label: 'P2P Personal Loan' },
  { id: '46', label: 'P2P Auto Loan' },
  { id: '47', label: 'P2P Education Loan' },
  { id: '50', label: 'Business Loan - Secured' },
  { id: '51', label: 'Business Loan - General' },
  { id: '52', label: 'Business Loan - Priority Sector - Small Business' },
  { id: '53', label: 'Business Loan - Priority Sector - Agriculture' },
  { id: '54', label: 'Business Loan - Priority Sector - Others' },
  { id: '55', label: 'Business Non-Funded Credit Facility - General' },
  { id: '56', label: 'Business Non-Funded Credit Facility - Priority Sector' },
  { id: '57', label: 'Business Non-Funded Credit Facility - Priority Sector - Agriculture' },
  { id: '58', label: 'Business Non-Funded Credit Facility - Priority Sector - Others' },
  { id: '59', label: 'Business Loan Against Bank Deposits' },
  { id: '61', label: 'Business Loan - Unsecured' },
  { id: '69', label: 'Short Term Personal Loan' },
  { id: '00', label: 'Other' },
  { id: '98', label: 'Secured (Account Group for Portfolio Review response)' },
  { id: '99', label: 'Unsecured (Account Group for Portfolio Review response)' },
];

const CIBIL_TRADELINE_ACCOUNT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CIBIL_TRADELINE_ACCOUNT_TYPES.map((type) => [type.id, type.label]),
);

export function cibilAccountTypeLabel(id: string): string {
  return CIBIL_TRADELINE_ACCOUNT_TYPE_LABEL[id] ?? `Type ${id}`;
}

export function parseCibilLoanTypeIds(value: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed || !/^\d{1,2}$/.test(trimmed)) continue;
    const symbol = trimmed.padStart(2, '0');
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    ids.push(symbol);
  }
  return ids;
}

export function serializeCibilLoanTypeIds(ids: string[]): string {
  const catalogOrder = CIBIL_TRADELINE_ACCOUNT_TYPES.map((type) => type.id);
  const selected = new Set(ids);
  const ordered = catalogOrder.filter((id) => selected.has(id));
  const extras = [...selected].filter((id) => !catalogOrder.includes(id)).sort();
  return [...ordered, ...extras].join(',');
}
