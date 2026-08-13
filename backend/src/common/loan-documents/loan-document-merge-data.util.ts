import {
  DLA_NAME,
  LENDER_NAME,
  LSP_NAME,
  NBFC_ADDRESS,
  NBFC_EMAIL,
  NBFC_NAME,
  PAYABLE_TO,
  RECOVERY_AGENT_NAME,
} from '../constants/loan-document.constants';
import { sanctionLetterLoanPurpose } from '../constants/loanReason.constants';
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

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function formatInr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatInterestRatePerDay(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return '';
  const trimmed = Number(rate.toFixed(4));
  const display = Number.isInteger(trimmed) ? String(trimmed) : String(trimmed);
  return `${display}% per day (fixed)`;
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
  // Sanction letter / KFS: borrower identity fields are always uppercase.
  const address = addressParts.join(', ').toUpperCase();
  const borrowerName = (input.fullName?.trim() ?? '').toUpperCase();
  const purposeOfLoan = sanctionLetterLoanPurpose(input.loanPurpose);

  const loanAmount = toNumber(input.loanAmountInr);
  const processingFeeAmount = toNumber(input.processingFeeAmountInr);
  const gstAmount = toNumber(input.gstAmountInr);
  const interestAmount = toNumber(input.interestAmountInr);
  const interestRate = toNumber(input.interestRatePerDayPercent);
  const netDisbursed =
    loanAmount != null
      ? loanAmount - (processingFeeAmount ?? 0) - (gstAmount ?? 0)
      : null;
  const tenure = input.loanTenureDays != null ? String(input.loanTenureDays) : '';
  const maturity =
    input.loanMaturityDate != null
      ? formatDateDdMmYyyy(
          input.loanMaturityDate instanceof Date ? input.loanMaturityDate : new Date(input.loanMaturityDate),
        )
      : '';

  return {
    NAME: borrowerName,
    BORROWER_NAME: borrowerName,
    PURPOSE_OF_LOAN: purposeOfLoan,
    SANCTIONED_AMOUNT: loanAmount != null ? formatInr(loanAmount) : '',
    DISBURSED_AMOUNT: netDisbursed != null ? formatInr(netDisbursed) : '',
    LOAN_AMOUNT: loanAmount != null ? formatInr(loanAmount) : '',
    INTEREST_RATE: formatInterestRatePerDay(interestRate),
    INTEREST_AMOUNT: interestAmount != null ? formatInr(interestAmount) : '',
    PROCESSING_FEE: processingFeeAmount != null ? formatInr(processingFeeAmount) : '',
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
    NBFC_NAME: NBFC_NAME,
    NBFC_ADDRESS: NBFC_ADDRESS,
    NBFC_EMAIL: NBFC_EMAIL,
    LENDER_NAME: LENDER_NAME,
    LSP_NAME: LSP_NAME,
    DLA_NAME: DLA_NAME,
    RECOVERY_AGENT_NAME: RECOVERY_AGENT_NAME,
    PAYABLE_TO: PAYABLE_TO,
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
