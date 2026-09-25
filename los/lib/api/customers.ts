import { cachedAuthorizedLosGet } from './_shared';

export type LosCustomer = {
  uuid: string;
  mobileNumber: string;
  fullName: string | null;
  isBlacklisted: boolean;
  kycVerifiedAt: string | null;
  leadCount: number;
  applicationCount: number;
  latestLeadStatusCode: string | null;
  latestLeadStatusLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LosCustomerLeadSummary = {
  uuid: string;
  statusCode: string;
  statusLabel: string;
  isActive: boolean;
  rejectionReason: { code: string; label: string } | null;
  leadStatusNote: string | null;
  sourceName: string | null;
  sourceType: string | null;
  panVerified: number;
  panVerifiedLabel: string;
  bureauFetched: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LosCustomerApplicationSummary = {
  uuid: string;
  applicationNumber: string;
  leadUuid: string;
  email: string | null;
  statusCode: string;
  statusLabel: string;
  loanAmount: string | null;
  loanTenure: number | null;
  kycStatus: number;
  kycStatusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type LosCustomerDetails = {
  uuid: string;
  mobileNumber: string;
  isBlacklisted: boolean;
  kycVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    fullName: string | null;
    dateOfBirth: string | null;
    panNumber: string | null;
    pincode: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    emailId: string | null;
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
  leads: LosCustomerLeadSummary[];
  applications: LosCustomerApplicationSummary[];
};

export async function getCustomers(token: string): Promise<LosCustomer[]> {
  return cachedAuthorizedLosGet<LosCustomer[]>(token, '/customers', 'Failed to fetch customers');
}

export async function getCustomerDetails(token: string, customerUuid: string): Promise<LosCustomerDetails> {
  return cachedAuthorizedLosGet<LosCustomerDetails>(
    token,
    `/customers/${encodeURIComponent(customerUuid)}`,
    'Failed to fetch customer details',
  );
}
