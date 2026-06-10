import {
  DEFAULT_MAX_MONTHLY_RATE_PERCENT,
  DEFAULT_PENAL_MAX_INR,
  DEFAULT_PENAL_MIN_INR,
  DEFAULT_PENAL_RATE_PERCENT,
  LENDER_GRO_NAME,
  LENDER_GRO_PHONE,
  LENDER_NODAL_NAME,
  LENDER_NODAL_PHONE,
  LENDER_NAME,
  LENDER_REGISTERED_OFFICE,
  LSP_GRO_NAME,
  LSP_GRO_PHONE,
  LSP_NODAL_NAME,
  LSP_NODAL_PHONE,
} from '../constants/loan-document.constants';
import { inrAmountToWords } from '../utils/inr-amount-words.util';
import { buildLoanDocumentReplacements } from './loan-document-merge-data.util';
import type { LoanDocumentMergeInput } from './loan-document.types';

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function formatInrPlain(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount));
}

function formatDateDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatAcceptanceTimestamp(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d)} IST`;
}

function computeAprPercent(
  principal: number | null,
  interest: number | null,
  tenureDays: number | null,
): string {
  if (principal == null || principal <= 0 || interest == null || tenureDays == null || tenureDays <= 0) {
    return '';
  }
  const apr = (interest / principal) * (365 / tenureDays) * 100;
  return `${apr.toFixed(2)}%`;
}

/** Maps HTML template `input#id` values from application merge data. */
export function buildLoanDocumentHtmlFieldValues(input: LoanDocumentMergeInput): Record<string, string> {
  const base = buildLoanDocumentReplacements(input);
  const now = input.asOf ?? new Date();
  const dateStr = base.DATE || formatDateDdMmYyyy(now);

  const loanAmount = toNumber(input.loanAmountInr);
  const processingFee = toNumber(input.processingFeeAmountInr);
  const gstAmount = toNumber(input.gstAmountInr);
  const interestAmount = toNumber(input.interestAmountInr);
  const interestRate = toNumber(input.interestRatePerDayPercent);
  const tenure = input.loanTenureDays;
  const netDisbursed =
    loanAmount != null ? loanAmount - (processingFee ?? 0) - (gstAmount ?? 0) : null;
  const totalPayable =
    loanAmount != null ? loanAmount + (interestAmount ?? 0) : null;
  const epiTotal = totalPayable;

  const processingPct =
    toNumber(input.processingFeePercent) ??
    (loanAmount != null && loanAmount > 0 && processingFee != null
      ? (processingFee / loanAmount) * 100
      : null);

  const borrowerName = base.NAME;
  const address = base.ADDRESS;
  const purpose = base.PURPOSE_OF_LOAN;
  const accountNo = input.applicationUuid?.trim() ?? '';
  const maturity =
    input.loanMaturityDate != null
      ? formatDateDdMmYyyy(
          input.loanMaturityDate instanceof Date ? input.loanMaturityDate : new Date(input.loanMaturityDate),
        )
      : dateStr;

  const map: Record<string, string> = {
    sl_borrower_name: borrowerName,
    sl_app_date: dateStr,
    sl_amount_fig: loanAmount != null ? formatInrPlain(loanAmount) : '',
    sl_amount_words: loanAmount != null ? inrAmountToWords(loanAmount) : '',
    sl_interest_rate: base.INTEREST_RATE,
    sl_proc_fee_amt: processingFee != null ? formatInrPlain(processingFee) : '',
    sl_proc_fee_pct: processingPct != null ? String(Number(processingPct.toFixed(2))) : '',
    sl_penal_rate: DEFAULT_PENAL_RATE_PERCENT,
    sl_penal_min: DEFAULT_PENAL_MIN_INR,
    sl_penal_max: DEFAULT_PENAL_MAX_INR,
    sl_max_rate: DEFAULT_MAX_MONTHLY_RATE_PERCENT,
    kfs_name: borrowerName,
    kfs_address: address,
    kfs_date: dateStr,
    kfs_borrower_name: borrowerName,
    kfs_purpose: purpose,
    kfs_account_no: accountNo,
    kfs_sanctioned_amt: loanAmount != null ? formatInrPlain(loanAmount) : '',
    kfs_net_disbursed: netDisbursed != null ? formatInrPlain(netDisbursed) : '',
    kfs_loan_term: tenure != null ? `${tenure} days` : '',
    kfs_epi_amount: epiTotal != null ? formatInrPlain(epiTotal) : '',
    kfs_commencement: tenure != null ? `${tenure} days` : '',
    kfs_interest_rate: base.INTEREST_RATE,
    kfs_total_interest: interestAmount != null ? formatInrPlain(interestAmount) : '',
    fee_processing:
      processingFee != null
        ? processingPct != null
          ? `${formatInrPlain(processingFee)} (${processingPct.toFixed(2)}%)`
          : formatInrPlain(processingFee)
        : '',
    kfs_apr: computeAprPercent(loanAmount, interestAmount, tenure),
    kfs_total_payable: totalPayable != null ? formatInrPlain(totalPayable) : '',
    rep_due_date: maturity,
    rep_principal: loanAmount != null ? formatInrPlain(loanAmount) : '',
    rep_interest: interestAmount != null ? formatInrPlain(interestAmount) : '',
    rep_total: totalPayable != null ? formatInrPlain(totalPayable) : '',
    gro_lsp_name: LSP_GRO_NAME,
    gro_lsp_phone: LSP_GRO_PHONE,
    nodal_lsp_name: LSP_NODAL_NAME,
    nodal_lsp_phone: LSP_NODAL_PHONE,
    gro_re_name: LENDER_GRO_NAME,
    gro_re_phone: LENDER_GRO_PHONE,
    nodal_re_name: LENDER_NODAL_NAME,
    nodal_re_phone: LENDER_NODAL_PHONE,
    decl_name: borrowerName,
    kfs_sig_name: borrowerName,
    kfs_sig_date: `${dateStr}, India`,
    ct_date: dateStr,
    ct_borrower_name: borrowerName,
    ct_borrower_address: address,
    ct_lender_office: LENDER_REGISTERED_OFFICE,
    sig_signed_by: borrowerName,
    sig_name: borrowerName,
    sig_ip: input.acceptanceIpAddress?.trim() ?? '',
    sig_ts:
      input.acceptanceSignedAt != null ? formatAcceptanceTimestamp(input.acceptanceSignedAt) : '',
    lender_dsc_signer: input.lenderDscSignerName?.trim() || LENDER_NAME,
    lender_dsc_date:
      input.lenderDscSignedAt != null ? formatAcceptanceTimestamp(input.lenderDscSignedAt) : '',
    lender_dsc_serial: input.lenderDscSerial?.trim() ?? '',
  };

  return Object.fromEntries(Object.entries(map).filter(([, v]) => v.length > 0));
}
