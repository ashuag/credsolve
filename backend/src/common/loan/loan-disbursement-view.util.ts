import type { Prisma } from '@prisma/client';
import { getLiveLoanFeeRates } from './live-loan-rates.cache';
import {
  computeDisburseAmountInr,
  computeInterestAmountFromLoanDetail,
  computeRepaymentAmountInr,
  decimalToNumber,
  type DecimalLike,
} from './loan-calculation.util';

export type LoanDetailStagingRow = {
  selectedLoanAmount: DecimalLike;
  interestRate: DecimalLike;
  processingFeePercentage: DecimalLike;
  gstPercentage: DecimalLike;
  expectedRepaymentDays: number | null;
  expectedRepaymentDate?: Date | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
} | null;

export type LoanAccountRow = {
  principalAmount: Prisma.Decimal;
  netDisbursedAmount: Prisma.Decimal;
  interestRate: Prisma.Decimal;
  interestAmount: Prisma.Decimal;
  totalRepaymentAmount: Prisma.Decimal;
  loanMaturityDate: Date;
  disbursedAt: Date;
  utr: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  loanAccountNumber: string;
} | null;

export type LosDisbursementApiView = {
  loanAmount: string | null;
  processingFeeAmount: string | null;
  gstAmount: string | null;
  disburseAmount: string | null;
  expectedRepaymentDays: number | null;
  expectedRepaymentDate: string | null;
  actualRepaymentDate: string | null;
  actualRepaymentDays: number | null;
  repaymentAmount: string | null;
  lateFee: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  disbursedAt: string | null;
  utr: string | null;
  amount: string | null;
  loanAccountNumber: string | null;
};

function dec(value: DecimalLike): string | null {
  return value != null ? String(value) : null;
}

function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function computeFeeAmountsFromLoanDetail(loanDetail: LoanDetailStagingRow): {
  processingFeeAmount: number | null;
  gstAmount: number | null;
  disburseAmount: number | null;
  repaymentAmount: number | null;
  interestAmount: number | null;
} {
  const principal = decimalToNumber(loanDetail?.selectedLoanAmount);
  const tenureDays = loanDetail?.expectedRepaymentDays ?? null;
  // PF / GST come from the live DB settings so an admin change applies on the
  // fly everywhere; the percentages stored on the row at selection time are
  // only a fallback for when the cache has never been primed.
  const liveRates = getLiveLoanFeeRates();
  const processingFeePct =
    liveRates?.processingFeePercent ?? decimalToNumber(loanDetail?.processingFeePercentage);
  const gstPct = liveRates?.processingFeeGstPercent ?? decimalToNumber(loanDetail?.gstPercentage);
  if (principal == null || tenureDays == null || processingFeePct == null || gstPct == null) {
    return {
      processingFeeAmount: null,
      gstAmount: null,
      disburseAmount: null,
      repaymentAmount: null,
      interestAmount: null,
    };
  }
  const interestAmount = computeInterestAmountFromLoanDetail(loanDetail, tenureDays);
  const processingFeeAmount = (principal * processingFeePct) / 100;
  const gstAmount = (processingFeeAmount * gstPct) / 100;
  const disburseAmount = computeDisburseAmountInr(principal, processingFeeAmount, gstAmount);
  const repaymentAmount = computeRepaymentAmountInr(principal, interestAmount ?? 0);
  return {
    processingFeeAmount,
    gstAmount,
    disburseAmount,
    repaymentAmount,
    interestAmount,
  };
}

/** API shape used by LOS/customer (legacy `disbursement` key). */
export function mapLosDisbursementApiView(
  loanDetail: LoanDetailStagingRow,
  loanAccount: LoanAccountRow,
): LosDisbursementApiView | null {
  if (loanAccount) {
    return {
      loanAmount: dec(loanAccount.principalAmount),
      processingFeeAmount: null,
      gstAmount: null,
      disburseAmount: dec(loanAccount.netDisbursedAmount),
      expectedRepaymentDays: null,
      expectedRepaymentDate: isoDateOnly(loanAccount.loanMaturityDate),
      actualRepaymentDate: null,
      actualRepaymentDays: null,
      repaymentAmount: dec(loanAccount.totalRepaymentAmount),
      lateFee: null,
      accountNumber: loanAccount.bankAccountNumber,
      ifscCode: loanAccount.ifscCode,
      bankName: null,
      disbursedAt: loanAccount.disbursedAt.toISOString(),
      utr: loanAccount.utr,
      amount: dec(loanAccount.principalAmount),
      loanAccountNumber: loanAccount.loanAccountNumber,
    };
  }

  if (!loanDetail) return null;

  const fees = computeFeeAmountsFromLoanDetail(loanDetail);
  return {
    loanAmount: dec(loanDetail.selectedLoanAmount),
    processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
    gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
    disburseAmount: fees.disburseAmount != null ? fees.disburseAmount.toFixed(2) : null,
    expectedRepaymentDays: loanDetail.expectedRepaymentDays,
    expectedRepaymentDate: isoDateOnly(loanDetail.expectedRepaymentDate),
    actualRepaymentDate: null,
    actualRepaymentDays: null,
    repaymentAmount: fees.repaymentAmount != null ? fees.repaymentAmount.toFixed(2) : null,
    lateFee: null,
    accountNumber: loanDetail.bankAccountNumber ?? null,
    ifscCode: loanDetail.ifscCode ?? null,
    bankName: loanDetail.bankName ?? null,
    disbursedAt: null,
    utr: null,
    amount: dec(loanDetail.selectedLoanAmount),
    loanAccountNumber: null,
  };
}

export function mapLosLoanDetailsFromStaging(
  loanDetail: NonNullable<LoanDetailStagingRow> & { reasonForLoan?: { name: string } | null },
): {
  reasonForLoan: string | null;
  loanAmount: string | null;
  loanTenure: number | null;
  interestRate: string | null;
  interestAmount: string | null;
  processingFee: string | null;
  processingFeeAmount: string | null;
  gstPercent: string | null;
  gstAmount: string | null;
  disbursedAmount: string | null;
  repaymentAmount: string | null;
  loanMaturityDate: string | null;
} {
  const fees = computeFeeAmountsFromLoanDetail(loanDetail);
  // Percent labels must match the live rates the amounts were computed with.
  const liveRates = getLiveLoanFeeRates();
  return {
    reasonForLoan: loanDetail.reasonForLoan?.name ?? null,
    loanAmount: dec(loanDetail.selectedLoanAmount),
    loanTenure: loanDetail.expectedRepaymentDays,
    interestRate: dec(loanDetail.interestRate),
    interestAmount: fees.interestAmount != null ? fees.interestAmount.toFixed(2) : null,
    processingFee:
      liveRates != null ? String(liveRates.processingFeePercent) : dec(loanDetail.processingFeePercentage),
    processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
    gstPercent:
      liveRates != null ? String(liveRates.processingFeeGstPercent) : dec(loanDetail.gstPercentage),
    gstAmount: fees.gstAmount != null ? fees.gstAmount.toFixed(2) : null,
    disbursedAmount: fees.disburseAmount != null ? fees.disburseAmount.toFixed(2) : null,
    repaymentAmount: fees.repaymentAmount != null ? fees.repaymentAmount.toFixed(2) : null,
    loanMaturityDate: isoDateOnly(loanDetail.expectedRepaymentDate),
  };
}
