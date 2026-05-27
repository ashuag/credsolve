export type LoanDocumentMergeInput = {
  fullName: string | null;
  mobileNumber: string | null;
  panNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  currentCity: string | null;
  pincode: string | null;
  loanAmountInr: string | number | null;
  loanTenureDays: number | null;
  loanMaturityDate: Date | string | null;
  asOf?: Date;
};
