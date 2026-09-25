import { LENDER_LOGO_FILE } from '../constants/loan-document.constants';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const IST = 'Asia/Kolkata';

/** `{loanNumber}{YYYYMMDDHHmmss}` in Asia/Kolkata. */
export function buildNocLetterNumber(loanNumber: string, at: Date = new Date()): string {
  const id = loanNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  const stamp = `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
  return `${id}${stamp}`;
}

/** dd/MM/yyyy in IST. */
export function formatNocDateShort(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}

/** e.g. July 14, 2026 in IST. */
export function formatNocDateLong(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: IST,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(at);
}

export function formatNocLoanAmountInr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatNocWaiver(amount: number): string {
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return '0.0';
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 1 });
}

export function buildBorrowerAddressLines(input: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  cityName?: string | null;
  stateName?: string | null;
  pincode?: string | null;
}): string {
  const parts = [
    input.addressLine1?.trim(),
    input.addressLine2?.trim(),
    [input.cityName?.trim(), input.stateName?.trim()].filter(Boolean).join(', ') || null,
    input.pincode?.trim(),
  ].filter((p): p is string => Boolean(p && p.length > 0));
  return parts.join(', ') || '—';
}

export type NocLetterTemplateValues = {
  letterNo: string;
  dateOfIssuance: string;
  borrowerName: string;
  borrowerAddress: string;
  loanAccountNo: string;
  agreementDated: string;
  productName: string;
  disbursalDate: string;
  loanAmount: string;
  nbfcName: string;
  dlaName: string;
  dateOfRepayment: string;
  dpd: string;
  settlementAmount: string;
  writtenOffAmount: string;
  waiver: string;
  accountStatus: string;
  extended: string;
  restructured: string;
  bureauMaskingAmount: string;
  maskingPaymentDate: string;
  amountReceivedDate: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderNocLetterHtml(values: NocLetterTemplateValues): Promise<string> {
  const templatePath = path.join(
    process.cwd(),
    'assets',
    'loan-documents',
    'templates',
    'Aasra_NOC_Letter.html',
  );
  let html = await readFile(templatePath, 'utf8');

  const logoPath = path.join(process.cwd(), 'assets', 'loan-documents', LENDER_LOGO_FILE);
  const logoBytes = await readFile(logoPath);
  const logoSrc = `data:image/png;base64,${logoBytes.toString('base64')}`;

  const map: Record<string, string> = {
    __LENDER_LOGO_SRC__: logoSrc,
    __LETTER_NO__: escapeHtml(values.letterNo),
    __DATE_OF_ISSUANCE__: escapeHtml(values.dateOfIssuance),
    __BORROWER_NAME__: escapeHtml(values.borrowerName),
    __BORROWER_ADDRESS__: escapeHtml(values.borrowerAddress),
    __LOAN_ACCOUNT_NO__: escapeHtml(values.loanAccountNo),
    __AGREEMENT_DATED__: escapeHtml(values.agreementDated),
    __PRODUCT_NAME__: escapeHtml(values.productName),
    __DISBURSAL_DATE__: escapeHtml(values.disbursalDate),
    __LOAN_AMOUNT__: escapeHtml(values.loanAmount),
    __NBFC_NAME__: escapeHtml(values.nbfcName),
    __DLA_NAME__: escapeHtml(values.dlaName),
    __DATE_OF_REPAYMENT__: escapeHtml(values.dateOfRepayment),
    __DPD__: escapeHtml(values.dpd),
    __SETTLEMENT_AMOUNT__: escapeHtml(values.settlementAmount),
    __WRITTEN_OFF_AMOUNT__: escapeHtml(values.writtenOffAmount),
    __WAIVER__: escapeHtml(values.waiver),
    __ACCOUNT_STATUS__: escapeHtml(values.accountStatus),
    __EXTENDED__: escapeHtml(values.extended),
    __RESTRUCTURED__: escapeHtml(values.restructured),
    __BUREAU_MASKING_AMOUNT__: escapeHtml(values.bureauMaskingAmount),
    __MASKING_PAYMENT_DATE__: escapeHtml(values.maskingPaymentDate),
    __AMOUNT_RECEIVED_DATE__: escapeHtml(values.amountReceivedDate),
  };

  for (const [token, value] of Object.entries(map)) {
    html = html.replaceAll(token, value);
  }
  return html;
}
