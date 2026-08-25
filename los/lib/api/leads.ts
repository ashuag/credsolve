import { authorizedLosRequest, cachedAuthorizedLosGet, clientApiUrl, fetchWithTimeout, invalidateClientReadCache, messageFromBody, parseJsonResponse, resolveLosClientApiUrl } from './_shared';

export type LosLead = {
  uuid: string;
  leadNumber: string;
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
  /** Public alphanumeric reference (exactly 12 chars, e.g. APP2026K7M2Q); reused as loan account number at disbursement. */
  applicationNumber: string;
  customerUuid: string;
  leadUuid: string | null;
  leadNumber: string | null;
  mobileNumber: string;
  email: string | null;
  fullName: string | null;
  cibilScore: number | null;
  /** Rule-based CIBIL credit-assessment category (A best .. H worst); null if not yet computed. */
  cibilCreditAssessmentCategory: string | null;
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
  nameMatchPendingReview?: boolean;
  leadStatusCode: string;
  leadStatusLabel: string;
  leadRejectionReason: { code: string; label: string } | null;
  leadStatusNote: string | null;
  kycStatus: number;
  kycStatusLabel: string;
  kycCompleted: boolean;
  kycCompletedAt: string | null;
  emailVerifiedAt: string | null;
  loanDocumentsReviewedAt: string | null;
  loanDocumentsAcceptedAt: string | null;
  livenessPassed: boolean;
  referencesCount: number;
  bankAccountNumber: string | null;
  disbursedAt: string | null;
  panVerified: number;
  bureauFetched: number;
  createdAt: string;
  updatedAt: string;
};

export type LosLeadDetails = {
  uuid: string;
  leadNumber: string;
  customerUuid: string;
  mobileNumber: string;
  email: string | null;
  statusCode: string;
  statusLabel: string;
  panVerified: number;
  panVerifiedLabel: string;
  /** Tenacio NSDL `nameMatch` from the latest PAN vendor_api_log for this lead. */
  panNameMatch: boolean | null;
  bureauFetched: number;
  bureauFetchedLabel: string;
  /** LOS / ops note on the lead row (`lead.lead_status_note`). */
  leadStatusNote: string | null;
  /** Vendor/bureau diagnostic text (`lead_detail.bureau_fetched_note`). */
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
    genderKey: string | null;
    occupation: string | null;
    occupationKey: string | null;
    netMonthlyIncome: string | null;
    annualTurnover: string | null;
    annualProfit: string | null;
    cibilConsentAt: string | null;
  } | null;
  bureauReport: {
    uuid: string;
    cibilScore: number | null;
    fetchedAt: string;
  } | null;
  applications: Array<{
    uuid: string;
    applicationNumber: string;
    statusCode: string;
    statusLabel: string;
    loanAmount: string | null;
    loanTenure: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type LosSelfieFaceValidation = {
  passed: boolean;
  checkedAt: string | null;
  bestComputedConfidence: number | null;
  topDetectionScore: number | null;
  reason: string | null;
  laplacianVariance: number | null;
  minLaplacianVarianceRequired: number;
  blurPassed: boolean | null;
  meanFaceLuminance: number | null;
  darkPixelRatio: number | null;
  minMeanFaceLuminanceRequired: number;
  maxDarkPixelRatioAllowed: number;
  lightingPassed: boolean | null;
  eyesOpenPassed: boolean | null;
  eyeAspectRatio: number | null;
  faceNotMaskedPassed: boolean | null;
  aiModifiedPassed: boolean | null;
  confidenceBreakdown: {
    detection: number;
    faceSize: number;
    landmarkAlignment: number;
    featureSpacing: number;
    computed: number;
  } | null;
};

export type LosLivenessSummary = {
  passed: boolean;
  checkedAt: string | null;
  /** @deprecated Tenacio passive liveness — customer journey uses MoneyCash active liveness. */
  vendorScore: number | null;
  /** @deprecated Tenacio passive liveness — customer journey uses MoneyCash active liveness. */
  isLive: boolean | null;
  /** @deprecated Tenacio passive liveness — customer journey uses MoneyCash active liveness. */
  vendorStatus: string | null;
  mode: 'smooth' | 'challenge' | null;
  activeLivenessPassed: boolean | null;
  activeLivenessReason: string | null;
  /** 0–1 head-movement strength scored from frames sampled during the liveness recording. */
  headMovementScore: number | null;
  headMovementMinScoreRequired: number | null;
  headMovementDirections: string[] | null;
  headTurnLeftDetected: boolean | null;
  headTurnRightDetected: boolean | null;
  headTiltUpDetected: boolean | null;
  headTiltDownDetected: boolean | null;
  blinkDetected: boolean | null;
  smileDetected: boolean | null;
  expressionAntiSpoofPassed: boolean | null;
  expressionAntiSpoofReason: string | null;
  framesWithFace: number | null;
  framesAnalyzed: number | null;
};

/** MoneyCash on-server face match (Aadhaar photo vs selfie). */
export type LosMoneyCashFaceMatch = {
  passed: boolean;
  checkedAt: string | null;
  matchScore: number | null;
  distance: number | null;
  maxDistanceThreshold: number;
  reason: string | null;
  reference: {
    faceDetected: boolean;
    detectionScore: number | null;
    imageWidth: number;
    imageHeight: number;
  } | null;
  probe: {
    faceDetected: boolean;
    detectionScore: number | null;
    imageWidth: number;
    imageHeight: number;
  } | null;
};

export type LosApplicationDetails = {
  uuid: string;
  applicationNumber: string;
  customerUuid: string;
  leadUuid: string;
  leadNumber: string;
  mobileNumber: string;
  email: string | null;
  emailVerifiedAt: string | null;
  statusCode: string;
  statusLabel: string;
  nameMatchPendingReview?: boolean;
  kycStatus: number;
  kycStatusLabel: string;
  kycCompletedAt: string | null;
  livenessPassed: boolean;
  livenessCheckCompleted: boolean;
  livenessAttempts: number;
  livenessCheckedAt: string | null;
  selfieFaceValidation: LosSelfieFaceValidation | null;
  moneyCashFaceMatch: LosMoneyCashFaceMatch | null;
  livenessSummary: LosLivenessSummary | null;
  kycPhotos: {
    /** Storage object key, e.g. `customer/{uuid}/photos/selfie/{app}.jpg`. */
    selfiePath: string | null;
    aadhaarPhotoPath: string | null;
    /** Storage object key for the active-liveness screen recording. */
    livenessVideoPath: string | null;
    /** Full HTTPS CDN/presigned URL when public storage is configured; otherwise LOS stream path. */
    selfieUrl: string | null;
    aadhaarPhotoUrl: string | null;
    livenessVideoUrl: string | null;
  };
  /** True when LOS ops may grant one more customer KYC liveness attempt. */
  canGrantKycLivenessRetry: boolean;
  /** Penny-drop bank verification attempts for the current application. */
  pennyDropVerification?: {
    attemptsUsed: number;
    attemptsAllowed: number;
    retryLimitReached: boolean;
    bankVerified: boolean;
  } | null;
  /** True when LOS ops may grant one more penny-drop (bank verification) attempt. */
  canGrantPennyDropAttempt?: boolean;
  /** Every penny-drop try from `application_bank_account_detail` (pass and fail). */
  bankAccountAttempts?: Array<{
    id: string;
    bankAccountNumber: string;
    ifscCode: string;
    bankName: string | null;
    accountHolderName: string | null;
    nameAtBank: string | null;
    status: boolean;
    nameMatchScore?: number | null;
    createdAt: string;
  }>;
  /** True when LOS ops may re-enable KYC selfie (DigiLocker Aadhaar is kept if already captured). */
  canEnableReKyc?: boolean;
  preApprovedLoanAmount: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    uuid: string;
    statusCode: string;
    statusLabel: string;
    leadStatusNote: string | null;
    bureauFetchedNote: string | null;
    bureauFetched: number;
    rejectionReason: { code: string; label: string } | null;
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
  /** DigiLocker PAN from Surepass (`customer_kyc.pan_card_number`). */
  digilockerPan: {
    panCardNumber: string;
    panCardVerifiedAt: string | null;
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
    loanMaturityDate: string | null;
  } | null;
  bureauReport: {
    uuid: string;
    cibilScore: number | null;
    reportPdfUrl: string | null;
    fetchedAt: string;
    /** Rule-based CIBIL credit-assessment category (A best .. H worst); null if not yet computed. */
    creditAssessmentCategory: string | null;
    creditAssessmentRecommendation: 'Approved' | 'Rejected' | null;
  } | null;
  agreement: {
    documentName: string | null;
    signedAt: string | null;
    ipAddress: string | null;
  } | null;
  disbursement: {
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
    /** @deprecated use loanAmount */
    amount: string | null;
  } | null;
  loanAccount: {
    /** Same as application_number; falls back to loanAccountNumber if older API. */
    loanNumber?: string;
    loanAccountNumber: string;
    principalAmount: string;
    netDisbursedAmount: string;
    interestRate: string;
    interestAmount: string;
    totalRepaymentAmount: string;
    disbursedAt: string;
    loanMaturityDate: string;
    utr: string | null;
    bankAccountNumber: string | null;
    ifscCode: string | null;
    closedAt: string | null;
  } | null;
  loanDocuments: {
    keyFactReady: boolean;
    keyFactEsigned: boolean;
    keyFactDisbursementReady: boolean;
    keyFactDisbursementEsigned: boolean;
    loanAgreementReady: boolean;
    /** Customer agreed on /loan-documents (no OTP). */
    reviewedAt: string | null;
    /** Mobile OTP after references. */
    acceptedAt: string | null;
  };
};

export async function getNewLeads(token: string): Promise<LosLead[]> {
  return cachedAuthorizedLosGet<LosLead[]>(token, '/leads/new', 'Failed to fetch new leads');
}

/** URL for the leads dump workbook download (LOS Leads). */
export function getLeadsExportUrl(token: string): string {
  const params = new URLSearchParams();
  params.set('access_token', token);
  return `${resolveLosClientApiUrl('/leads/export')}?${params.toString()}`;
}

export async function getApplications(token: string): Promise<LosApplication[]> {
  return cachedAuthorizedLosGet<LosApplication[]>(token, '/applications', 'Failed to fetch applications');
}

/** URL for the applications dump workbook download (LOS Application). */
export function getApplicationsExportUrl(token: string): string {
  const params = new URLSearchParams();
  params.set('access_token', token);
  return `${resolveLosClientApiUrl('/applications/export')}?${params.toString()}`;
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
  invalidateClientReadCache();
}

export async function fetchApplicationLoanDocumentBlob(
  token: string,
  applicationUuid: string,
  docType: 'key-fact' | 'key-fact-disbursement',
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
