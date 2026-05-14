import { cachedAuthorizedLosGet } from './_shared';

export type LosLead = {
  uuid: string;
  customerUuid: string;
  mobileNumber: string;
  email: string | null;
  statusCode: string;
  statusLabel: string;
  sourceName: string | null;
  sourceType: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LosApplication = {
  uuid: string;
  customerUuid: string;
  leadUuid: string | null;
  mobileNumber: string;
  email: string | null;
  fullName: string | null;
  loanAmount: string | null;
  statusCode: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type LosLeadDetails = {
  uuid: string;
  customerUuid: string;
  mobileNumber: string;
  email: string | null;
  statusCode: string;
  statusLabel: string;
  /** LOS / ops note on the lead row (`lead.lead_status_note`). */
  leadStatusNote: string | null;
  /** Vendor/bureau diagnostic text (`lead.bureau_fetched_note`). */
  bureauFetchedNote: string | null;
  /** Master rejection reason when `rejection_reason_id` is set. */
  rejectionReason: { code: string; label: string } | null;
  sourceName: string | null;
  sourceType: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    fullName: string | null;
    dateOfBirth: string | null;
    panNumber: string | null;
    pincode: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    stateCode: string | null;
    gender: string | null;
    occupation: string | null;
    netMonthlyIncome: string | null;
    annualTurnover: string | null;
    annualProfit: string | null;
    cibilConsentAt: string | null;
  } | null;
  applications: Array<{
    uuid: string;
    statusCode: string;
    statusLabel: string;
    loanAmount: string | null;
    loanTenure: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type LosApplicationDetails = {
  uuid: string;
  customerUuid: string;
  leadUuid: string;
  mobileNumber: string;
  email: string | null;
  emailVerifiedAt: string | null;
  statusCode: string;
  statusLabel: string;
  kycStatus: number;
  kycStatusLabel: string;
  kycCompletedAt: string | null;
  livenessPassed: boolean;
  livenessCheckedAt: string | null;
  preApprovedLoanAmount: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    uuid: string;
    statusCode: string;
    statusLabel: string;
    panNumber: string | null;
    profile: LosLeadDetails['profile'];
  };
  details: {
    reasonForLoan: string | null;
    loanAmount: string | null;
    loanTenure: number | null;
    interestRate: string | null;
    interestAmount: string | null;
    processingFee: string | null;
    processingFeeAmount: string | null;
    gstAmount: string | null;
    loanDisbursementDate: string | null;
    loanMaturityDate: string | null;
  } | null;
  eligibility: {
    isEligible: boolean;
    approvedAmount: string | null;
    cibilScore: number | null;
    ineligibleReason: string | null;
    checkedAt: string;
  } | null;
  agreement: {
    documentName: string | null;
    signedAt: string | null;
    ipAddress: string | null;
  } | null;
  disbursement: {
    amount: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
    bankName: string | null;
    utr: string | null;
    disbursedAt: string | null;
  } | null;
};

export async function getNewLeads(token: string): Promise<LosLead[]> {
  return cachedAuthorizedLosGet<LosLead[]>(token, '/leads/new', 'Failed to fetch new leads');
}

export async function getApplications(token: string): Promise<LosApplication[]> {
  return cachedAuthorizedLosGet<LosApplication[]>(token, '/applications', 'Failed to fetch applications');
}

export async function getLeadDetails(token: string, leadUuid: string): Promise<LosLeadDetails> {
  return cachedAuthorizedLosGet<LosLeadDetails>(
    token,
    `/leads/${encodeURIComponent(leadUuid)}`,
    'Failed to fetch lead details',
  );
}

export async function getApplicationDetails(token: string, applicationUuid: string): Promise<LosApplicationDetails> {
  return cachedAuthorizedLosGet<LosApplicationDetails>(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}`,
    'Failed to fetch application details',
  );
}
