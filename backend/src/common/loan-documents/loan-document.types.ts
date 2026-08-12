export type LoanDocumentMergeInput = {
  fullName: string | null;
  mobileNumber: string | null;
  panNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  currentCity: string | null;
  pincode: string | null;
  loanAmountInr: string | number | null;
  loanPurpose: string | null;
  interestRatePerDayPercent: string | number | null;
  interestAmountInr: string | number | null;
  processingFeeAmountInr: string | number | null;
  gstAmountInr: string | number | null;
  loanTenureDays: number | null;
  loanMaturityDate: Date | string | null;
  applicationUuid?: string | null;
  /** Public application reference (exactly 12 chars, e.g. APP2026K7M2Q); preferred for KFS account no. */
  applicationNumber?: string | null;
  processingFeePercent?: string | number | null;
  asOf?: Date;
  /** Captured when the customer accepts loan documents (OTP verified). */
  acceptanceIpAddress?: string | null;
  acceptanceSignedAt?: Date | string | null;
  /** NBFC PKCS#7 stamp — set when generating the execution (signed) PDF. */
  lenderDscSignerName?: string | null;
  lenderDscSignedAt?: Date | string | null;
  lenderDscSerial?: string | null;
  /** Active bounce charge schedule rows for sanction letter / KFS tables. */
  bounceChargeTiers?: Array<{
    minAmountInr: number;
    maxAmountInr: number | null;
    bounceFeeInr: { toNumber(): number } | number | string;
    sortOrder?: number;
    isActive?: boolean;
  }> | null;
  /** Penal charge parameters from the `PENAL_*` settings, for sanction letter / KFS text. */
  penalCharges?: {
    ratePercent: number;
    minInr: number;
    maxInr: number;
  } | null;
};
