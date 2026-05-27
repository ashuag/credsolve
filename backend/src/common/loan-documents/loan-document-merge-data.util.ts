import type { LoanDocumentMergeInput } from './loan-document.types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function formatInr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Placeholder keys match `[NAME]` style tags in the Word templates. */
export function buildLoanDocumentReplacements(input: LoanDocumentMergeInput): Record<string, string> {
  const now = input.asOf ?? new Date();
  const addressParts = [input.addressLine1, input.addressLine2, input.currentCity, input.pincode]
    .map((s) => s?.trim())
    .filter(Boolean);
  const address = addressParts.join(', ');

  const loanAmount = input.loanAmountInr != null ? Number(input.loanAmountInr) : null;
  const tenure = input.loanTenureDays != null ? String(input.loanTenureDays) : '';
  const maturity =
    input.loanMaturityDate != null
      ? formatDateDdMmYyyy(
          input.loanMaturityDate instanceof Date ? input.loanMaturityDate : new Date(input.loanMaturityDate),
        )
      : '';

  return {
    NAME: input.fullName?.trim() ?? '',
    AMOUNT: loanAmount != null ? formatInr(loanAmount) : '',
    'ADDRESS OF THE BORROWER': address,
    ADDRESS: address,
    Month: MONTH_NAMES[now.getMonth()] ?? '',
    Date: String(now.getDate()),
    Year: String(now.getFullYear()),
    'YYYY-MM-DD': formatDateDdMmYyyy(now),
    DATE: formatDateDdMmYyyy(now),
    'loan term': tenure ? `${tenure} days` : '',
    'Loan term': tenure ? `${tenure} days` : '',
    'DD-MM-YYYY': maturity || formatDateDdMmYyyy(now),
    mobileNumber: input.mobileNumber?.trim() ?? '',
    panNumber: input.panNumber?.trim() ?? '',
  };
}

/** Apply `[KEY]` replacements to document.xml text nodes (order: longest keys first). */
export function applyReplacementsToXml(xml: string, replacements: Record<string, string>): string {
  const entries = Object.entries(replacements)
    .filter(([, v]) => v.length > 0)
    .sort((a, b) => b[0].length - a[0].length);

  let out = xml;
  for (const [key, value] of entries) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\[${escaped}\\]`, 'g'), escapeXmlText(value));
  }
  return out;
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
