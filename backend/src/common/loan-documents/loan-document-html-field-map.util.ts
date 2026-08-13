import {
  LENDER_GRO_NAME,
  LENDER_GRO_PHONE,
  LENDER_GRO_EMAIL,
  LENDER_NODAL_NAME,
  LENDER_NODAL_PHONE,
  LENDER_NODAL_EMAIL,
  LENDER_NAME,
  LENDER_REGISTERED_OFFICE,
  LSP_GRO_NAME,
  LSP_GRO_PHONE,
  LSP_GRO_EMAIL,
  LSP_NODAL_NAME,
  LSP_NODAL_PHONE,
  LSP_NODAL_EMAIL,
} from '../constants/loan-document.constants';
import {
  DEFAULT_PENAL_CHARGE_CONFIG,
  formatPenalChargeDisplay,
} from '../loan/bounce-charge.util';
import { SettingKey } from '../constants/setting.constants';
import { normalizeClientIp } from '../http/client-ip.util';
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

function formatPercent(value: number): string {
  const trimmed = Number(value.toFixed(2));
  const display = Number.isInteger(trimmed) ? String(trimmed) : String(trimmed);
  return `${display}%`;
}

/** Numeric ROI display for “shall not exceed X% per day” (no % suffix; template supplies it). */
function formatRoiPerDayNumber(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) {
    return SettingKey.ROI_PER_DAY.default;
  }
  const trimmed = Number(rate.toFixed(4));
  return Number.isInteger(trimmed) ? String(trimmed) : String(trimmed);
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

/**
 * Loan-period cost and simple annualised APR (as used on KFS):
 *   periodCost = (totalPayable / netDisbursed) − 1
 *   APR        = periodCost × 12 × 100
 * where netDisbursed = sanctioned − processing fee − GST.
 *
 * Example: 14040 / 10300.8 − 1 = 36.30%, APR = 36.30 × 12 ≈ 436%.
 */
function computeAprPercent(
  loanAmount: number | null,
  processingFee: number | null,
  gstAmount: number | null,
  totalPayable: number | null,
): string {
  if (loanAmount == null || loanAmount <= 0 || totalPayable == null) {
    return '';
  }
  const netDisbursed = loanAmount - (processingFee ?? 0) - (gstAmount ?? 0);
  if (!(netDisbursed > 0)) return '';
  const periodCost = totalPayable / netDisbursed - 1;
  if (!Number.isFinite(periodCost) || periodCost < 0) return '';
  const apr = periodCost * 12 * 100;
  return `${Math.round(apr)}%`;
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
  const accountNo = input.applicationNumber?.trim() ?? '';
  const maturity =
    input.loanMaturityDate != null
      ? formatDateDdMmYyyy(
          input.loanMaturityDate instanceof Date ? input.loanMaturityDate : new Date(input.loanMaturityDate),
        )
      : dateStr;

  const penal = formatPenalChargeDisplay(input.penalCharges ?? DEFAULT_PENAL_CHARGE_CONFIG);

  const map: Record<string, string> = {
    sl_borrower_name: borrowerName,
    sl_app_date: dateStr,
    sl_amount_fig: loanAmount != null ? formatInrPlain(loanAmount) : '',
    sl_amount_words: loanAmount != null ? inrAmountToWords(loanAmount) : '',
    sl_interest_rate: base.INTEREST_RATE,
    sl_proc_fee_amt: processingFee != null ? formatInrPlain(processingFee) : '',
    sl_proc_fee_pct: processingPct != null ? formatPercent(processingPct) : '',
    sl_penal_rate: penal.ratePercent,
    sl_penal_min: penal.minInr,
    sl_penal_max: penal.maxInr,
    // Cap statement uses per-day ROI from application (settings `ROI_PER_DAY`), not a monthly %.
    sl_max_rate: formatRoiPerDayNumber(interestRate),
    kfs_name: borrowerName,
    kfs_address: address,
    kfs_date: dateStr,
    kfs_borrower_name: borrowerName,
    kfs_purpose: purpose,
    kfs_account_no: accountNo,
    kfs_sanctioned_amt: loanAmount != null ? `₹${formatInrPlain(loanAmount)}` : '',
    kfs_net_disbursed: netDisbursed != null ? formatInrPlain(netDisbursed) : '',
    kfs_loan_term: tenure != null ? `${tenure} days` : '',
    kfs_epi_amount: epiTotal != null ? `₹${formatInrPlain(epiTotal)}` : '',
    kfs_commencement: tenure != null ? `${tenure} days` : '',
    kfs_interest_rate: base.INTEREST_RATE,
    kfs_total_interest: interestAmount != null ? `₹${formatInrPlain(interestAmount)}` : '',
    fee_processing:
      processingFee != null
        ? processingPct != null
          ? `₹${formatInrPlain(processingFee)} (${processingPct.toFixed(2)}%)`
          : `₹${formatInrPlain(processingFee)}`
        : '',
    kfs_apr: computeAprPercent(loanAmount, processingFee, gstAmount, totalPayable),
    kfs_total_payable: totalPayable != null ? `₹${formatInrPlain(totalPayable)}` : '',
    rep_due_date: maturity,
    rep_principal: loanAmount != null ? `₹${formatInrPlain(loanAmount)}` : '',
    rep_interest: interestAmount != null ? `₹${formatInrPlain(interestAmount)}` : '',
    rep_total: totalPayable != null ? `₹${formatInrPlain(totalPayable)}` : '',
    gro_lsp_name: LSP_GRO_NAME,
    gro_lsp_phone: LSP_GRO_PHONE,
    gro_lsp_email: LSP_GRO_EMAIL,
    nodal_lsp_name: LSP_NODAL_NAME,
    nodal_lsp_phone: LSP_NODAL_PHONE,
    nodal_lsp_email: LSP_NODAL_EMAIL,
    gro_re_name: LENDER_GRO_NAME,
    gro_re_phone: LENDER_GRO_PHONE,
    gro_re_email: LENDER_GRO_EMAIL,
    nodal_re_name: LENDER_NODAL_NAME,
    nodal_re_phone: LENDER_NODAL_PHONE,
    nodal_re_email: LENDER_NODAL_EMAIL,
    decl_name: borrowerName,
    kfs_sig_name: borrowerName,
    kfs_sig_date: `${dateStr}, India`,
    ct_date: dateStr,
    ct_borrower_name: borrowerName,
    ct_borrower_address: address,
    ct_lender_office: LENDER_REGISTERED_OFFICE,
    ...(input.acceptanceSignedAt != null
      ? {
          sig_signed_by: borrowerName,
          sig_name: borrowerName,
          sig_ip: normalizeClientIp(input.acceptanceIpAddress) ?? '',
          sig_ts: formatAcceptanceTimestamp(input.acceptanceSignedAt),
        }
      : {}),
    lender_dsc_signer: input.lenderDscSignerName?.trim() || LENDER_NAME,
    lender_dsc_date:
      input.lenderDscSignedAt != null
        ? formatAcceptanceTimestamp(input.lenderDscSignedAt)
        : input.acceptanceSignedAt != null
          ? formatAcceptanceTimestamp(input.acceptanceSignedAt)
          : '',
    lender_dsc_serial: input.lenderDscSerial?.trim() ?? '',
  };

  return Object.fromEntries(Object.entries(map).filter(([, v]) => v.length > 0));
}
