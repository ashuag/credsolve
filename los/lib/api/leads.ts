import { authorizedLosRequest, cachedAuthorizedLosGet, clientApiUrl, fetchWithTimeout, messageFromBody, parseJsonResponse } from './_shared';

export type LosLead = {
  uuid: string;
  customerUuid: string;
  fullName: string | null;
  panNumber: string | null;
  mobileNumber: string;
  email: string | null;
  occupation: string | null;
  city: string | null;
  cibilScore: number | null;
  panVerified: number;
  panVerifiedLabel: string;
  rejectionReason: { code: string; label: string } | null;
  leadStatusNote: string | null;
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
  cibilScore: number | null;
  eligibleLoanAmount: string | null;
  selectedLoanAmount: string | null;
  repayDate: string | null;
  repaymentAmount: string | null;
  emi: string | null;
  processingFeePercent: string | null;
  processingFeeAmount: string | null;
  bankDetails: string | null;
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
  panVerified: number;
  panVerifiedLabel: string;
  bureauFetched: number;
  bureauFetchedLabel: string;
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
  kycPhotos: {
    /** Storage object key, e.g. `customer/{uuid}/photos/selfie/{app}.jpg`. */
    selfiePath: string | null;
    aadhaarPhotoPath: string | null;
    /** Full HTTPS CDN/presigned URL when public storage is configured; otherwise LOS stream path. */
    selfieUrl: string | null;
    aadhaarPhotoUrl: string | null;
  };
  preApprovedLoanAmount: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    uuid: string;
    statusCode: string;
    statusLabel: string;
    sourceName: string | null;
    sourceType: string | null;
    utms: Array<{
      capturedAt: string;
      source: string | null;
      medium: string | null;
      campaign: string | null;
      term: string | null;
      content: string | null;
    }>;
    panNumber: string | null;
    panVerified: number;
    bureauFetched: number;
    profile: LosLeadDetails['profile'];
  };
  referencesCount: number;
  references: Array<{
    referenceIndex: number;
    fullName: string;
    mobileNumber: string;
    relation: string;
  }>;
  aadhaarDetail: {
    fullName: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    address: string | null;
    maskedAadhaar: string | null;
  } | null;
  details: {
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
  bureauReport: {
    uuid: string;
    cibilScore: number | null;
    htmlUrl: string | null;
    reportPdfUrl: string | null;
    fetchedAt: string;
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
  loanDocuments: {
    keyFactReady: boolean;
    keyFactEsigned: boolean;
    loanAgreementReady: boolean;
    acceptedAt: string | null;
  };
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

/** Absolute CDN/presigned URL, or LOS API path with `access_token` for `<img src>`. */
export function resolveLosKycPhotoSrc(
  url: string | null | undefined,
  token: string,
  photoVersion?: string | number | null,
): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = clientApiUrl().replace(/\/+$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const params = new URLSearchParams();
  params.set('access_token', token);
  if (photoVersion != null && String(photoVersion).trim()) {
    params.set('v', String(photoVersion));
  }
  return `${base}${path}?${params.toString()}`;
}

export async function fetchLosAuthenticatedBlob(token: string, path: string, fallbackMessage: string): Promise<Blob> {
  const response = await fetchWithTimeout(`${clientApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    throw new Error(messageFromBody(body) ?? fallbackMessage);
  }

  return response.blob();
}

type FetchBureauResponse = {
  success: boolean;
  configured: boolean;
  message?: string | null;
  transportError?: string | null;
};

export async function createApplicationCibilReport(
  token: string,
  payload: { leadUuid: string; mobileNumber: string; fullName: string; panNumber: string },
): Promise<void> {
  const vendorApiBase = clientApiUrl().replace(/\/los$/, '');
  const response = await fetchWithTimeout(`${vendorApiBase}/vendor/tenacio/bureau`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leadUuid: payload.leadUuid,
      input: {
        mobileNumber: payload.mobileNumber,
        name: payload.fullName,
        panNumber: payload.panNumber,
        consent: true,
      },
    }),
    cache: 'no-store',
  });

  const body = (await parseJsonResponse(response)) as FetchBureauResponse | null;
  if (!response.ok) {
    throw new Error(messageFromBody(body) ?? 'Failed to create CIBIL report.');
  }
  if (!body?.success) {
    throw new Error(body?.message ?? body?.transportError ?? 'CIBIL report creation failed.');
  }
}

export async function fetchApplicationLoanDocumentBlob(
  token: string,
  applicationUuid: string,
  docType: 'key-fact',
): Promise<Blob> {
  return fetchLosAuthenticatedBlob(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/loan-documents/${encodeURIComponent(docType)}`,
    'Failed to fetch loan document PDF.',
  );
}

export async function generateApplicationLoanDocuments(
  token: string,
  applicationUuid: string,
): Promise<{ applicationUuid: string; generated: string[] }> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/loan-documents/generate`,
    { method: 'POST' },
    'Failed to generate loan documents.',
  );
}
