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
  processingFeePercent?: string | number | null;
  asOf?: Date;
  /** Captured when the customer accepts loan documents (OTP verified). */
  acceptanceIpAddress?: string | null;
  acceptanceSignedAt?: Date | string | null;
  /** NBFC PKCS#7 stamp — set when generating the execution (signed) PDF. */
  lenderDscSignerName?: string | null;
  lenderDscSignedAt?: Date | string | null;
  lenderDscSerial?: string | null;
};
