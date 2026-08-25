import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { BureauReportPdfService } from '../../../common/cibil/bureau-report-pdf.service';
import { CibilCreditAssessmentService } from '../../../common/cibil/cibil-credit-assessment.service';
import { isDigilockerAadhaarCaptureComplete } from '../../../common/kyc/aadhaar-vendor-parse.util';
import { extractProfileFromDigilockerFormJson } from '../../../common/kyc/digilocker-form-profile.util';
import { appendPhotoCacheBuster } from '../../../common/kyc/kyc-photo-url.util';
import { buildLivenessVendorSummary } from '../../../common/kyc/kyc-liveness-summary.util';
import { extractLocalFaceMatchFromVendorJson } from '../../../common/kyc/kyc-face-match-inspection-persist.util';
import { parsePersistedSelfieFaceValidation } from '../../../common/kyc/kyc-selfie-face-inspection-persist.util';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { resolveLivenessVideoRelativePath } from '../../../common/kyc/kyc-liveness-video-path.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';
import { BUREAU_FETCHED } from '../../../common/constants/bureau-fetch.constants';
import { PAN_VERIFIED } from '../../../common/constants/pan-verification.constants';
import { buildSimpleXlsxWorkbook, type SimpleXlsxCell } from '../../../common/xlsx/simple-xlsx';
import { LoanDocumentApplicationService } from '../../auth/application/services/loan-document-application.service';
import { LOAN_DOCUMENT_ACCEPTANCE_NAME, LOAN_DOCUMENT_TYPE, type LoanDocumentType } from '../../../common/constants/loan-document.constants';
import {
  computeFeeAmountsFromLoanDetail,
  mapLosDisbursementApiView,
  mapLosLoanDetailsFromStaging,
} from '../../../common/loan/loan-disbursement-view.util';
import { APPLICATION_KYC_STATUS, APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { BANK_DETAIL_FAILED_NOTE, isBankNameMatchReviewPending, PENNY_DROP_FAILED_NOTE } from '../../../common/constants/bank.constants';
import { SettingKey } from '../../../common/constants/setting.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { REJECTION_REASON, toRejectionReasonDto } from '../../../common/constants/rejection-reason.constants';
import { canEnableReKyc } from '../kyc-grant-retry.util';
import { canGrantPennyDropAttempt } from '../penny-drop-grant-retry.util';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

function mapLeadRejectionReason(
  reason: { name: string } | null | undefined,
  applicationStatusName?: string,
): { code: string; label: string } | null {
  const mapped = toRejectionReasonDto(reason ?? null);
  if (mapped) return mapped;
  if (applicationStatusName === APPLICATION_STATUS.PENNYDROP_FAILED) {
    return toRejectionReasonDto({ name: REJECTION_REASON.PENNYDROP_FAILED });
  }
  return null;
}

/** Applications still in the ops queue — never drop these for the listing cap. */
const OPEN_APPLICATION_QUEUE_STATUSES: readonly string[] = [
  APPLICATION_STATUS.DRAFT,
  APPLICATION_STATUS.IN_REVIEW,
  APPLICATION_STATUS.UNDER_REVIEW,
  APPLICATION_STATUS.APPROVED,
  APPLICATION_STATUS.KYC_FAILED,
  APPLICATION_STATUS.PENNYDROP_FAILED,
  APPLICATION_STATUS.INTERNAL_ERROR,
  APPLICATION_STATUS.ACTIVE,
];

const APPLICATION_LISTING_RECENT_CAP = 500;

const loanDocumentApplicationSelect = {
  id: true,
  uuid: true,
  applicationNumber: true,
  customerId: true,
  details: {
    select: {
      emailId: true,
      emailVerificationType: true,
      loanDocumentsAcceptedAt: true,
      loanDocumentsAcceptedIp: true,
      keyFactPdfRelativePath: true,
      keyFactEsigned: true,
      keyFactDisbursementPdfRelativePath: true,
      keyFactDisbursementEsigned: true,
      loanAgreementPdfRelativePath: true,
      selectedLoanAmount: true,
      interestRate: true,
      processingFeePercentage: true,
      gstPercentage: true,
      expectedRepaymentDays: true,
      expectedRepaymentDate: true,
      reasonForLoan: { select: { name: true } },
    },
  },
  customer: { select: { id: true, uuid: true, mobileNumber: true } },
  lead: {
    select: {
      leadDetail: {
        select: {
          panNumber: true,
          fullName: true,
          addressLine1: true,
          addressLine2: true,
          pincode: true,
          city: { select: { name: true } },
        },
      },
    },
  },
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickAadhaarString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function formatAadhaarDob(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function buildLosAadhaarDetail(formJson: unknown): {
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  maskedAadhaar: string | null;
} | null {
  if (!isDigilockerAadhaarCaptureComplete(formJson) || !isRecord(formJson)) return null;

  const identity = extractProfileFromDigilockerFormJson(formJson);
  const gender = pickAadhaarString(formJson, ['gender', 'Gender']);
  const maskedAadhaar = pickAadhaarString(formJson, [
    'maskedAadhaar',
    'masked_aadhaar',
    'uid',
    'aadhaarNumber',
    'aadhaar_number',
    'aadhaar',
  ]);
  const addressParts = [
    pickAadhaarString(formJson, ['address', 'fullAddress', 'full_address', 'residentAddress', 'resident_address']),
    pickAadhaarString(formJson, ['house', 'houseNo', 'house_no']),
    pickAadhaarString(formJson, ['street', 'streetName', 'street_name']),
    pickAadhaarString(formJson, ['landmark']),
    pickAadhaarString(formJson, ['locality', 'vtc', 'villageTownCity']),
    pickAadhaarString(formJson, ['district', 'dist']),
    pickAadhaarString(formJson, ['state']),
    pickAadhaarString(formJson, ['pincode', 'pin', 'pinCode']),
  ].filter((part): part is string => Boolean(part));
  const address = addressParts.length > 0 ? [...new Set(addressParts)].join(', ') : null;

  return {
    fullName: formatLosPersonName(identity.fullName),
    dateOfBirth: formatAadhaarDob(identity.dateOfBirth),
    gender,
    address,
    maskedAadhaar,
  };
}

function maskBankDetails(bankName: string | null | undefined, accountNumber: string | null | undefined, ifscCode: string | null | undefined): string | null {
  const bank = bankName?.trim();
  const tail = accountNumber?.replace(/\D/g, '').slice(-4);
  const ifsc = ifscCode?.trim().toUpperCase();
  if (bank && tail && ifsc) return `${bank} ••••${tail} (${ifsc})`;
  if (bank && tail) return `${bank} ••••${tail}`;
  if (bank && ifsc) return `${bank} (${ifsc})`;
  if (bank) return bank;
  if (tail && ifsc) return `••••${tail} (${ifsc})`;
  if (tail) return `Account ••••${tail}`;
  if (ifsc) return ifsc;
  return null;
}

function applicationKycStatusLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Not done';
    case 1:
      return 'Completed';
    case 2:
      return 'Failed';
    case 3:
      return 'Technical issue';
    default:
      return `Unknown (${code})`;
  }
}

function panVerifiedStatusLabel(code: number): string {
  switch (code) {
    case PAN_VERIFIED.NOT_CHECKED:
      return 'Not checked';
    case PAN_VERIFIED.VERIFIED:
      return 'Verified';
    case PAN_VERIFIED.NOT_VERIFIED:
      return 'Not verified';
    case PAN_VERIFIED.API_FAILURE:
      return 'API failure';
    case PAN_VERIFIED.API_DISABLED:
      return 'Disabled';
    default:
      return `Unknown (${code})`;
  }
}

function bureauFetchedStatusLabel(code: number): string {
  switch (code) {
    case BUREAU_FETCHED.NOT_FETCHED:
      return 'Not fetched';
    case BUREAU_FETCHED.SUCCESS:
      return 'Fetched';
    case BUREAU_FETCHED.FAILED:
      return 'Failed';
    default:
      return `Unknown (${code})`;
  }
}

const APPLICATION_DUMP_STAGE_ORDER = [
  { id: 'profile', label: 'Profile' },
  { id: 'credit', label: 'PAN & bureau' },
  { id: 'loan', label: 'Loan offer' },
  { id: 'email', label: 'Email OTP' },
  { id: 'letter', label: 'Sanction letter' },
  { id: 'kyc', label: 'KYC' },
  { id: 'bank', label: 'Bank details' },
  { id: 'refs', label: 'References' },
  { id: 'esign', label: 'eSign' },
] as const;

function dumpApplicationStageLabel(input: {
  statusCode: string;
  statusLabel: string;
  kycStatus: number;
  kycStatusLabel: string;
  kycCompletedAt: string | null;
  emailVerifiedAt: string | null;
  loanDocumentsReviewedAt: string | null;
  loanDocumentsAcceptedAt: string | null;
  selectedLoanAmount: string | null;
  referencesCount: number;
  bankAccountNumber: string | null;
  disbursedAt: string | null;
  fullName: string | null;
  leadStatusCode: string;
  leadStatusLabel: string;
  leadStatusNote?: string | null;
  panVerified: number;
  bureauFetched: number;
  nameMatchPendingReview?: boolean;
}): string {
  const leadRejected = input.leadStatusCode.toUpperCase() === 'REJECTED';
  const appRejected = input.statusCode.toUpperCase().includes('REJECT');
  const kycFailed = input.statusCode.toUpperCase() === 'KYC_FAILED' || input.kycStatus === 2;
  const pennyFailed = input.statusCode.toUpperCase() === 'PENNYDROP_FAILED';

  if (leadRejected || appRejected || kycFailed || pennyFailed) {
    if (input.leadStatusCode.toUpperCase().includes('REJECT')) return input.leadStatusLabel;
    if (input.statusCode.toUpperCase().includes('REJECT')) return input.statusLabel;
    if (input.statusCode.toUpperCase() === 'KYC_FAILED') return input.kycStatusLabel;
    if (pennyFailed) return input.statusLabel || BANK_DETAIL_FAILED_NOTE;
    return 'Rejected';
  }

  if (
    (input.leadStatusNote?.trim().toLowerCase() === BANK_DETAIL_FAILED_NOTE.toLowerCase() ||
      input.leadStatusNote?.trim().toLowerCase() === PENNY_DROP_FAILED_NOTE.toLowerCase()) &&
    !input.bankAccountNumber
  ) {
    return BANK_DETAIL_FAILED_NOTE;
  }

  const doneById = {
    profile: Boolean(input.fullName?.trim()),
    credit: input.panVerified === PAN_VERIFIED.VERIFIED && input.bureauFetched === BUREAU_FETCHED.SUCCESS,
    loan: Boolean(input.selectedLoanAmount),
    email: Boolean(input.emailVerifiedAt),
    letter: Boolean(input.loanDocumentsReviewedAt ?? input.loanDocumentsAcceptedAt),
    kyc: input.kycStatus === 1 && input.kycCompletedAt != null,
    bank: Boolean(input.bankAccountNumber || input.disbursedAt) && !input.nameMatchPendingReview,
    refs: input.referencesCount >= 2,
    esign: Boolean(input.loanDocumentsAcceptedAt),
  } as const;

  const active = APPLICATION_DUMP_STAGE_ORDER.find((stage) => !doneById[stage.id]);
  return active?.label ?? input.statusLabel;
}

function dumpApplicationStatusLabel(input: {
  leadStatusCode: string;
  leadStatusLabel: string;
  statusLabel: string;
}): string {
  if (input.leadStatusCode.toUpperCase().includes('REJECT')) return input.leadStatusLabel;
  return input.statusLabel;
}

function toExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toExcelNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const APPLICATION_DUMP_HEADERS = [
  'Lead ID',
  'Application ID',
  'Name',
  'Mobile',
  'Email',
  'CIBIL score',
  'Grade',
  'Eligible loan amount',
  'Selected loan amount',
  'Repay date',
  'Repayment amount',
  'Processing fee %',
  'Processing fee amount',
  'Bank details',
  'Stage',
  'Status',
  'Lead status',
  'Rejection reason',
  'Rejection note',
  'KYC status',
  'PAN verified',
  'Bureau fetched',
  'Created',
  'Last modified',
  'Disbursed at',
  'Application UUID',
  'Customer UUID',
  'Lead UUID',
] as const;

@Injectable()
export class LosApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly kycFiles: KycFilesService,
    private readonly loanDocs: LoanDocumentApplicationService,
    private readonly cibilCreditAssessment: CibilCreditAssessmentService,
  ) {}

  async listApplications() {
    const listingWhere: Prisma.ApplicationWhereInput = {
      lead: { isInternalTesting: false },
    };
    const recentRows = await this.prisma.read.application.findMany({
      where: listingWhere,
      orderBy: { createdAt: 'desc' },
      take: APPLICATION_LISTING_RECENT_CAP,
      select: { id: true },
    });
    const recentIds = recentRows.map((row) => row.id);
    const applications = await this.prisma.read.application.findMany({
      where: {
        AND: [
          listingWhere,
          {
            OR: [
              { applicationStatus: { name: { in: [...OPEN_APPLICATION_QUEUE_STATUSES] } } },
              ...(recentIds.length > 0 ? [{ id: { in: recentIds } }] : []),
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: {
          select: {
            uuid: true,
            leadNumber: true,
            leadStatusNote: true,
            leadDetail: {
              select: {
                fullName: true,
                panVerified: true,
                bureauFetched: true,
              },
            },
            leadStatus: { select: { name: true, displayName: true } },
            rejectionReason: { select: { name: true } },
            bureauReports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { cibilScore: true, cibilCreditAssessment: { select: { category: true } } },
            },
          },
        },
        applicationStatus: { select: { name: true, displayName: true } },
        details: {
          select: {
            selectedLoanAmount: true,
            processingFeePercentage: true,
            gstPercentage: true,
            expectedRepaymentDays: true,
            expectedRepaymentDate: true,
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true,
            interestRate: true,
            emailId: true,
            emailVerifiedAt: true,
            loanDocumentsReviewedAt: true,
            loanDocumentsAcceptedAt: true,
          },
        },
        kyc: { select: { kycStatus: true, kycCompletedAt: true, livenessPassed: true } },
        _count: { select: { references: true } },
        loanAccount: {
          select: {
            totalRepaymentAmount: true,
            loanMaturityDate: true,
            disbursedAt: true,
            principalAmount: true,
            loanAccountNumber: true,
          },
        },
      },
    });

    return applications.map((application) => {
      const appDetails = application.details;
      const loanAccount = application.loanAccount;
      const fees = computeFeeAmountsFromLoanDetail(appDetails, {
        preferStoredTenure: loanAccount != null,
      });
      const kycStatus = application.kyc?.kycStatus ?? 0;
      const repaymentAmount =
        loanAccount?.totalRepaymentAmount?.toString()
        ?? (fees.repaymentAmount != null ? fees.repaymentAmount.toFixed(2) : null);
      const eligibleLoanAmount = application.preApprovedLoanAmount?.toString() ?? null;

      return {
        uuid: application.uuid,
        applicationNumber: application.applicationNumber,
        leadId: Number(application.leadId),
        leadNumber: application.lead.leadNumber,
        customerUuid: application.customer.uuid,
        leadUuid: application.lead.uuid,
        mobileNumber: application.customer.mobileNumber,
        email: appDetails?.emailId ?? null,
        fullName: formatLosPersonName(application.lead.leadDetail?.fullName),
        cibilScore: application.lead.bureauReports[0]?.cibilScore ?? null,
        cibilCreditAssessmentCategory: application.lead.bureauReports[0]?.cibilCreditAssessment?.category ?? null,
        eligibleLoanAmount,
        selectedLoanAmount: appDetails?.selectedLoanAmount?.toString() ?? null,
        repayDate: loanAccount
          ? loanAccount.loanMaturityDate.toISOString().slice(0, 10)
          : appDetails?.expectedRepaymentDate?.toISOString().slice(0, 10) ?? null,
        repaymentAmount,
        emi: repaymentAmount,
        processingFeePercent: appDetails?.processingFeePercentage?.toString() ?? null,
        processingFeeAmount: fees.processingFeeAmount != null ? fees.processingFeeAmount.toFixed(2) : null,
        bankDetails: maskBankDetails(
          appDetails?.bankName,
          appDetails?.bankAccountNumber,
          appDetails?.ifscCode,
        ),
        statusCode: application.applicationStatus.name,
        statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
        nameMatchPendingReview: isBankNameMatchReviewPending({
          statusName: application.applicationStatus.name,
          statusNote: application.applicationStatusNote,
        }),
        leadStatusCode: application.lead.leadStatus.name,
        leadStatusLabel: displayName(application.lead.leadStatus.name, application.lead.leadStatus.displayName),
        leadRejectionReason: mapLeadRejectionReason(
          application.lead.rejectionReason,
          application.applicationStatus.name,
        ),
        leadStatusNote: application.lead.leadStatusNote?.trim() || null,
        kycStatus,
        kycStatusLabel: applicationKycStatusLabel(kycStatus),
        kycCompleted: kycStatus === 1,
        kycCompletedAt: application.kyc?.kycCompletedAt?.toISOString() ?? null,
        emailVerifiedAt: appDetails?.emailVerifiedAt?.toISOString() ?? null,
        loanDocumentsReviewedAt: appDetails?.loanDocumentsReviewedAt?.toISOString() ?? null,
        loanDocumentsAcceptedAt: appDetails?.loanDocumentsAcceptedAt?.toISOString() ?? null,
        livenessPassed: application.kyc?.livenessPassed ?? false,
        referencesCount: application._count.references,
        bankAccountNumber: appDetails?.bankAccountNumber ?? null,
        disbursedAt: loanAccount?.disbursedAt?.toISOString() ?? null,
        panVerified: application.lead.leadDetail?.panVerified ?? 0,
        bureauFetched: application.lead.leadDetail?.bureauFetched ?? 0,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      };
    });
  }

  /** Builds an applications dump workbook for LOS Application → Download dump. */
  async exportApplicationsWorkbook(): Promise<Buffer> {
    const applications = await this.listApplications();
    const rows: SimpleXlsxCell[][] = [
      [...APPLICATION_DUMP_HEADERS],
      ...applications.map((app) => [
        app.leadNumber,
        app.applicationNumber,
        app.fullName,
        app.mobileNumber,
        app.email,
        toExcelNumber(app.cibilScore),
        app.cibilCreditAssessmentCategory,
        toExcelNumber(app.eligibleLoanAmount),
        toExcelNumber(app.selectedLoanAmount),
        app.repayDate,
        toExcelNumber(app.repaymentAmount),
        toExcelNumber(app.processingFeePercent),
        toExcelNumber(app.processingFeeAmount),
        app.bankDetails,
        dumpApplicationStageLabel(app),
        dumpApplicationStatusLabel(app),
        app.leadStatusLabel,
        app.leadRejectionReason?.label ?? null,
        app.leadStatusNote,
        app.kycStatusLabel,
        panVerifiedStatusLabel(app.panVerified),
        bureauFetchedStatusLabel(app.bureauFetched),
        toExcelDate(app.createdAt),
        toExcelDate(app.updatedAt),
        toExcelDate(app.disbursedAt),
        app.uuid,
        app.customerUuid,
        app.leadUuid,
      ]),
    ];
    return buildSimpleXlsxWorkbook(rows, 'Applications');
  }

  async getApplicationDetails(applicationUuid: string) {
    const [application, pennyDropAttemptsAllowed] = await Promise.all([
      this.prisma.read.application.findUnique({
        where: { uuid: applicationUuid },
        include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: {
          include: {
            leadStatus: { select: { name: true, displayName: true } },
            rejectionReason: { select: { name: true } },
            source: { select: { name: true, type: true } },
            leadDetail: {
              include: {
                city: { select: { name: true, state: { select: { name: true, code: true } } } },
                gender: { select: { name: true, key: true } },
                occupation: { select: { name: true, key: true } },
              },
            },
            leadUtms: { orderBy: { createdAt: 'desc' } },
          },
        },
        applicationStatus: { select: { name: true, displayName: true } },
        details: {
          include: {
            reasonForLoan: { select: { name: true } },
          },
        },
        kyc: true,
        references: {
          orderBy: { referenceIndex: 'asc' },
          select: {
            referenceIndex: true,
            fullName: true,
            mobileNumber: true,
            relation: { select: { name: true } },
          },
        },
        loanAccount: true,
        bankAccountDetails: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true,
            accountHolderName: true,
            nameAtBank: true,
            status: true,
            nameMatchScore: true,
            createdAt: true,
          },
        },
      },
    }),
      this.loadPennyDropRetryCount(),
    ]);

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const lead = application.lead;
    const detail = lead.leadDetail;

    const bureauReportRow = await this.prisma.read.bureauReport.findFirst({
      where: { leadId: application.leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        uuid: true,
        cibilScore: true,
        createdAt: true,
        cibilCreditAssessment: { select: { category: true, creditRecommendation: true } },
      },
    });

    let bureauReportPdfUrl: string | null = null;
    if (bureauReportRow) {
      const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
        leadId: application.leadId,
        customerUuid: application.customer.uuid,
      });
      bureauReportPdfUrl = this.resolveBureauReportPdfUrl(application.uuid, pdfResult, true);
    }

    const customerKyc = await this.prisma.read.customerKyc.findFirst({
      where: { customerId: application.customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        aadhaarData: true,
        aadhaarPhotoPath: true,
        panCardNumber: true,
        panCardVerifiedAt: true,
      },
    });

    const selfieRelativePath = application.kyc?.livenessSelfiePath?.trim() || null;
    const aadhaarPhotoRelativePath = customerKyc?.aadhaarPhotoPath?.trim() || null;
    const livenessVideoRelativePath = await resolveLivenessVideoRelativePath({
      columnPath: application.kyc?.livenessVideoPath,
      vendorJson: application.kyc?.livenessVendorJson,
      customerUuid: application.customer.uuid,
      applicationUuid: application.uuid,
      kycFiles: this.kycFiles,
    });
    const photoVersion = application.updatedAt.getTime();
    const [selfiePublicUrl, aadhaarPublicUrl, livenessVideoPublicUrl] = await Promise.all([
      selfieRelativePath ? this.kycFiles.resolvePublicReadUrl(selfieRelativePath) : Promise.resolve(null),
      aadhaarPhotoRelativePath ? this.kycFiles.resolvePublicReadUrl(aadhaarPhotoRelativePath) : Promise.resolve(null),
      livenessVideoRelativePath
        ? this.kycFiles.resolvePublicReadUrl(livenessVideoRelativePath)
        : Promise.resolve(null),
    ]);
    const bust = (url: string | null) =>
      url && /^https?:\/\//i.test(url) ? appendPhotoCacheBuster(url, photoVersion) : url;

    return {
      uuid: application.uuid,
      applicationNumber: application.applicationNumber,
      customerUuid: application.customer.uuid,
      leadUuid: lead.uuid,
      leadNumber: lead.leadNumber,
      mobileNumber: application.customer.mobileNumber,
      email: application.details?.emailId ?? null,
      emailVerifiedAt: application.details?.emailVerifiedAt?.toISOString() ?? null,
      statusCode: application.applicationStatus.name,
      statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
      nameMatchPendingReview: isBankNameMatchReviewPending({
        statusName: application.applicationStatus.name,
        statusNote: application.applicationStatusNote,
      }),
      kycStatus: application.kyc?.kycStatus ?? 0,
      kycStatusLabel: applicationKycStatusLabel(application.kyc?.kycStatus ?? 0),
      kycCompletedAt: application.kyc?.kycCompletedAt?.toISOString() ?? null,
      livenessPassed: application.kyc?.livenessPassed ?? false,
      livenessCheckCompleted: application.kyc?.isLiveness ?? false,
      livenessAttempts: application.kyc?.livenessAttempts ?? 0,
      livenessCheckedAt: application.kyc?.livenessCheckedAt?.toISOString() ?? null,
      selfieFaceValidation: parsePersistedSelfieFaceValidation(
        application.kyc?.selfieFaceValidationJson,
        application.kyc?.selfieFaceValidationPassed ?? false,
        application.kyc?.faceMatchCheckedAt ?? null,
      ),
      moneyCashFaceMatch: extractLocalFaceMatchFromVendorJson(application.kyc?.livenessVendorJson),
      livenessSummary: buildLivenessVendorSummary({
        passed: application.kyc?.livenessPassed ?? false,
        checkedAt: application.kyc?.livenessCheckedAt ?? null,
        vendor: application.kyc?.livenessVendorJson,
      }),
      kycPhotos: {
        selfiePath: selfieRelativePath,
        aadhaarPhotoPath: aadhaarPhotoRelativePath,
        livenessVideoPath: livenessVideoRelativePath,
        selfieUrl:
          bust(selfiePublicUrl) ??
          (selfieRelativePath ? `/applications/${application.uuid}/kyc/selfie-photo` : null),
        aadhaarPhotoUrl:
          bust(aadhaarPublicUrl) ??
          (aadhaarPhotoRelativePath ? `/applications/${application.uuid}/kyc/aadhaar-photo` : null),
        livenessVideoUrl:
          bust(livenessVideoPublicUrl) ??
          (livenessVideoRelativePath
            ? `/applications/${application.uuid}/kyc/liveness-video`
            : null),
      },
      canGrantKycLivenessRetry: false,
      pennyDropVerification: {
        attemptsUsed: application.details?.pennyDropAttempts ?? 0,
        attemptsAllowed: pennyDropAttemptsAllowed,
        retryLimitReached: (application.details?.pennyDropAttempts ?? 0) >= pennyDropAttemptsAllowed,
        bankVerified: Boolean(application.details?.bankAccountNumber?.trim()),
      },
      canGrantPennyDropAttempt: canGrantPennyDropAttempt({
        attemptsUsed: application.details?.pennyDropAttempts ?? 0,
        attemptsAllowed: pennyDropAttemptsAllowed,
        bankVerified: Boolean(application.details?.bankAccountNumber?.trim()),
        disbursed: Boolean(application.loanAccount?.disbursedAt),
        applicationStatusCode: application.applicationStatus.name,
        leadStatusCode: lead.leadStatus.name,
      }),
      bankAccountAttempts: application.bankAccountDetails.map((attempt) => ({
        id: attempt.id.toString(),
        bankAccountNumber: attempt.bankAccountNumber,
        ifscCode: attempt.ifscCode,
        bankName: attempt.bankName,
        accountHolderName: attempt.accountHolderName,
        nameAtBank: attempt.nameAtBank,
        status: attempt.status,
        nameMatchScore: attempt.nameMatchScore,
        createdAt: attempt.createdAt.toISOString(),
      })),
      canEnableReKyc: canEnableReKyc({
        kycStatus: application.kyc?.kycStatus ?? 0,
        livenessPassed: application.kyc?.livenessPassed ?? false,
        livenessCheckCompleted: application.kyc?.isLiveness ?? false,
        livenessAttempts: application.kyc?.livenessAttempts ?? 0,
        livenessCheckedAt: application.kyc?.livenessCheckedAt ?? null,
        applicationStatusCode: application.applicationStatus.name,
        leadStatusCode: lead.leadStatus.name,
        hasKycArtifacts: Boolean(selfieRelativePath?.trim() || aadhaarPhotoRelativePath?.trim()),
      }),
      preApprovedLoanAmount: application.preApprovedLoanAmount?.toString() ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      lead: {
        uuid: lead.uuid,
        statusCode: lead.leadStatus.name,
        statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
        leadStatusNote: lead.leadStatusNote?.trim() || null,
        bureauFetchedNote: detail?.bureauFetchedNote?.trim() || null,
        bureauFetched: detail?.bureauFetched ?? 0,
        rejectionReason: mapLeadRejectionReason(lead.rejectionReason, application.applicationStatus.name),
        sourceName: lead.source?.name ?? null,
        sourceType: lead.source?.type ?? null,
        utms: lead.leadUtms.map((utm) => ({
          capturedAt: utm.createdAt.toISOString(),
          source: utm.utmSource,
          medium: utm.utmMedium,
          campaign: utm.utmCampaign,
          term: utm.utmTerm,
          content: utm.utmContent,
        })),
        panNumber: detail?.panNumber ?? null,
        panVerified: detail?.panVerified ?? 0,
        profile: detail
          ? {
              fullName: formatLosPersonName(detail.fullName),
              dateOfBirth: detail.dateOfBirth ? detail.dateOfBirth.toISOString().slice(0, 10) : null,
              panNumber: detail.panNumber,
              pincode: detail.pincode,
              addressLine1: detail.addressLine1,
              addressLine2: detail.addressLine2,
              city: detail.city?.name ?? null,
              state: detail.city?.state?.name ?? null,
              stateCode: detail.city?.state?.code ?? null,
              gender: detail.gender?.name ?? null,
              genderKey: detail.gender?.key ?? null,
              occupation: detail.occupation?.name ?? null,
              occupationKey: detail.occupation?.key ?? null,
              netMonthlyIncome: detail.netMonthlyIncome?.toString() ?? null,
              annualTurnover: detail.annualTurnover?.toString() ?? null,
              annualProfit: detail.annualProfit?.toString() ?? null,
              cibilConsentAt: detail.cibilConsentAt?.toISOString() ?? null,
            }
          : null,
      },
      referencesCount: application.references.length,
      references: application.references.map((ref) => ({
        referenceIndex: ref.referenceIndex,
        fullName: formatLosPersonName(ref.fullName) ?? ref.fullName,
        mobileNumber: ref.mobileNumber,
        relation: ref.relation.name,
      })),
      aadhaarDetail: buildLosAadhaarDetail(customerKyc?.aadhaarData),
      digilockerPan: customerKyc?.panCardNumber
        ? {
            panCardNumber: customerKyc.panCardNumber,
            panCardVerifiedAt: customerKyc.panCardVerifiedAt?.toISOString() ?? null,
          }
        : null,
      details: application.details
        ? mapLosLoanDetailsFromStaging(application.details, {
            preferStoredTenure: application.loanAccount != null,
          })
        : null,
      bureauReport: bureauReportRow
        ? {
            uuid: bureauReportRow.uuid,
            cibilScore: bureauReportRow.cibilScore,
            reportPdfUrl: bureauReportPdfUrl,
            fetchedAt: bureauReportRow.createdAt.toISOString(),
            creditAssessmentCategory: bureauReportRow.cibilCreditAssessment?.category ?? null,
            creditAssessmentRecommendation: bureauReportRow.cibilCreditAssessment?.creditRecommendation ?? null,
          }
        : null,
      agreement: buildLoanAgreementView(application.details),
      disbursement: mapLosDisbursementApiView(application.details, application.loanAccount),
      loanAccount: application.loanAccount
        ? {
            loanNumber:
              'loanNumber' in application.loanAccount &&
              typeof (application.loanAccount as { loanNumber?: string }).loanNumber === 'string'
                ? (application.loanAccount as { loanNumber: string }).loanNumber
                : application.loanAccount.loanAccountNumber,
            loanAccountNumber: application.loanAccount.loanAccountNumber,
            principalAmount: application.loanAccount.principalAmount.toString(),
            netDisbursedAmount: application.loanAccount.netDisbursedAmount.toString(),
            interestRate: application.loanAccount.interestRate.toString(),
            interestAmount: application.loanAccount.interestAmount.toString(),
            totalRepaymentAmount: application.loanAccount.totalRepaymentAmount.toString(),
            disbursedAt: application.loanAccount.disbursedAt.toISOString(),
            loanMaturityDate: application.loanAccount.loanMaturityDate.toISOString().slice(0, 10),
            utr: application.loanAccount.utr,
            bankAccountNumber: application.loanAccount.bankAccountNumber,
            ifscCode: application.loanAccount.ifscCode,
            closedAt: application.loanAccount.closedAt?.toISOString() ?? null,
          }
        : null,
      loanDocuments: {
        keyFactReady: !!application.details?.keyFactPdfRelativePath?.trim(),
        keyFactEsigned: application.details?.keyFactEsigned ?? false,
        keyFactDisbursementReady: !!application.details?.keyFactDisbursementPdfRelativePath?.trim(),
        keyFactDisbursementEsigned: application.details?.keyFactDisbursementEsigned ?? false,
        loanAgreementReady: !!application.details?.loanAgreementPdfRelativePath?.trim(),
        reviewedAt: application.details?.loanDocumentsReviewedAt?.toISOString() ?? null,
        acceptedAt: application.details?.loanDocumentsAcceptedAt?.toISOString() ?? null,
      },
    };
  }

  async serveApplicationSelfiePhoto(applicationUuid: string, res: Response): Promise<void> {
    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: { kyc: { select: { livenessSelfiePath: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const rel = application.kyc?.livenessSelfiePath?.trim();
    if (!rel) {
      throw new NotFoundException('Selfie is not saved yet.');
    }
    await this.streamKycPhoto(rel, res);
  }

  async serveApplicationAadhaarPhoto(applicationUuid: string, res: Response): Promise<void> {
    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: { customerId: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const customerKyc = await this.prisma.read.customerKyc.findFirst({
      where: { customerId: application.customerId },
      orderBy: { createdAt: 'desc' },
      select: { aadhaarPhotoPath: true },
    });
    const rel = customerKyc?.aadhaarPhotoPath?.trim();
    if (!rel) {
      throw new NotFoundException('Aadhaar photo is not available yet.');
    }
    await this.streamKycPhoto(rel, res);
  }

  async serveApplicationLivenessVideo(applicationUuid: string, res: Response): Promise<void> {
    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        uuid: true,
        customer: { select: { uuid: true } },
        kyc: { select: { livenessVideoPath: true, livenessVendorJson: true } },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const rel = await resolveLivenessVideoRelativePath({
      columnPath: application.kyc?.livenessVideoPath,
      vendorJson: application.kyc?.livenessVendorJson,
      customerUuid: application.customer.uuid,
      applicationUuid: application.uuid,
      kycFiles: this.kycFiles,
    });
    if (!rel) {
      throw new NotFoundException('Liveness video is not available yet.');
    }
    await this.streamKycVideo(rel, res);
  }

  async serveApplicationLoanDocument(applicationUuid: string, docTypeRaw: string, res: Response): Promise<void> {
    const allowed: LoanDocumentType[] = [
      LOAN_DOCUMENT_TYPE.KEY_FACT,
      LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT,
    ];
    if (!allowed.includes(docTypeRaw as LoanDocumentType)) {
      throw new BadRequestException('Unknown loan document type.');
    }
    const docType = docTypeRaw as LoanDocumentType;

    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: loanDocumentApplicationSelect,
    });
    if (!application) throw new NotFoundException('Application not found.');

    const docCtx = toLoanDocumentContext(application);
    const existing = this.loanDocs.relativePathForType(docType, docCtx);

    // Disbursement KFS is only served from stored file (never auto-regenerate acceptance overwrite).
    if (docType === LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT) {
      const rel = existing?.trim() ?? '';
      if (!rel) throw new NotFoundException('Disbursement sanction letter has not been generated yet.');
      if (!(await this.kycFiles.exists(rel))) {
        throw new NotFoundException('Disbursement document file is missing from storage.');
      }
      let buf: Buffer;
      try {
        buf = await this.kycFiles.readBytes(rel);
      } catch (err) {
        if (isStorageObjectMissing(err)) {
          throw new NotFoundException('Disbursement document file is missing from storage.');
        }
        throw err;
      }
      const title = this.loanDocs.documentTitle(docType);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${title}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.send(buf);
      return;
    }

    const canGenerate = Boolean(
      application.details?.selectedLoanAmount && application.details?.expectedRepaymentDays,
    );

    let rel: string;
    if (canGenerate) {
      const merge = this.loanDocs.buildMergeInput({
        customer: application.customer,
        lead: application.lead,
        application: docCtx,
      });
      rel = await this.loanDocs.ensurePdf(
        docType,
        application.customer.uuid,
        application.uuid,
        application.id,
        merge,
        existing,
        false,
        docCtx.loanDocumentsAcceptedAt != null,
      );
    } else {
      rel = existing?.trim() ?? '';
      if (!rel) throw new NotFoundException('This document has not been generated yet.');
      if (!(await this.kycFiles.exists(rel))) {
        throw new NotFoundException('Document file is missing from storage. Complete loan selection and regenerate.');
      }
    }

    let buf: Buffer;
    try {
      buf = await this.kycFiles.readBytes(rel);
    } catch (err) {
      if (isStorageObjectMissing(err)) {
        throw new NotFoundException('Document file is missing from storage. Regenerate it from the application review panel.');
      }
      throw err;
    }

    const title = this.loanDocs.documentTitle(docType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${title}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  private async streamKycPhoto(relativePath: string, res: Response): Promise<void> {
    const buf = await this.kycFiles.readBytes(relativePath);
    const lower = relativePath.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  private async streamKycVideo(relativePath: string, res: Response): Promise<void> {
    const buf = await this.kycFiles.readBytes(relativePath);
    const lower = relativePath.toLowerCase();
    const mime = lower.endsWith('.mp4')
      ? 'video/mp4'
      : lower.endsWith('.webm')
        ? 'video/webm'
        : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  async serveApplicationCibilReportPdf(applicationUuid: string, res: Response): Promise<void> {
    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        leadId: true,
        customer: { select: { uuid: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
      leadId: application.leadId,
      customerUuid: application.customer.uuid,
    });
    if (!pdfResult?.relativePath) {
      throw new NotFoundException('Bureau report PDF is not available for this application.');
    }

    let buf: Buffer;
    try {
      buf = await this.kycFiles.readBytes(pdfResult.relativePath);
    } catch (err) {
      if (isStorageObjectMissing(err)) {
        throw new NotFoundException('Bureau report PDF file is missing from storage.');
      }
      throw err;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="cibil-summary-report.pdf"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }

  async getApplicationCibilReport(applicationUuid: string) {
    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        leadId: true,
        customer: { select: { uuid: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const bureauReportRow = await this.prisma.read.bureauReport.findFirst({
      where: { leadId: application.leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        rawPayload: true,
        createdAt: true,
      },
    });

    if (!bureauReportRow) {
      throw new NotFoundException('No bureau report found for this application');
    }

    if (bureauReportRow.rawPayload == null) {
      throw new NotFoundException('Bureau report has no stored JSON payload');
    }

    const pdfResult = await this.bureauReportPdf.ensurePdfForLead({
      leadId: application.leadId,
      customerUuid: application.customer.uuid,
    });

    const report = await this.bureauReportPdf.buildReportViewData(bureauReportRow.rawPayload);
    const creditAssessment = await this.cibilCreditAssessment.getViewForBureauReportId(
      bureauReportRow.id,
      this.prisma.read,
    );

    return {
      bureauReportUuid: bureauReportRow.uuid,
      fetchedAt: bureauReportRow.createdAt.toISOString(),
      reportPdfUrl: this.resolveBureauReportPdfUrl(applicationUuid, pdfResult, true),
      rawPayload: bureauReportRow.rawPayload,
      report,
      creditAssessment,
    };
  }

  async generateLoanDocuments(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: loanDocumentApplicationSelect,
    });

    if (!application) throw new NotFoundException(`Application ${applicationUuid} not found`);
    if (!application.details?.selectedLoanAmount || !application.details?.expectedRepaymentDays) {
      throw new NotFoundException('Loan selection is incomplete — cannot generate documents.');
    }

    // Always compute from application_detail snapshots (PF/GST/ROI/tenure), never live settings.
    const docCtx = toLoanDocumentContext(application);
    const merge = this.loanDocs.buildMergeInput({
      customer: application.customer,
      lead: application.lead,
      application: docCtx,
    });

    const generated: LoanDocumentType[] = [];
    const customerUuid = application.customer.uuid;
    const digitallySignAcceptance = docCtx.loanDocumentsAcceptedAt != null;

    // Never overwrite an existing acceptance KFS object on disk.
    const docType = LOAN_DOCUMENT_TYPE.KEY_FACT;
    const existingKeyFact = this.loanDocs.relativePathForType(docType, docCtx);
    const keyFactExists =
      Boolean(existingKeyFact?.trim()) && (await this.kycFiles.exists(existingKeyFact!.trim()));

    if (!keyFactExists) {
      await this.loanDocs.ensurePdf(
        docType,
        customerUuid,
        application.uuid,
        application.id,
        merge,
        null,
        false,
        digitallySignAcceptance,
        false,
      );
      generated.push(docType);
    } else if (!digitallySignAcceptance) {
      // Pre-acceptance refresh: write a new uniquely named file; keep the prior object in storage.
      await this.loanDocs.ensurePdf(
        docType,
        customerUuid,
        application.uuid,
        application.id,
        merge,
        existingKeyFact,
        true,
        false,
        true,
      );
      generated.push(docType);
    }

    const isDisbursed =
      Boolean(docCtx.keyFactDisbursementPdfRelativePath?.trim()) ||
      (await this.prisma.client.loanAccount.findUnique({
        where: { applicationId: application.id },
        select: { id: true },
      })) != null;

    // After customer acceptance (or once disbursed), mint a separate revised KFS as a NEW file —
    // never replace the acceptance PDF or a prior disbursement PDF object.
    if (digitallySignAcceptance || isDisbursed) {
      const disbType = LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT;
      const disbExisting = this.loanDocs.relativePathForType(disbType, docCtx);
      await this.loanDocs.ensurePdf(
        disbType,
        customerUuid,
        application.uuid,
        application.id,
        merge,
        disbExisting,
        true,
        true,
        true,
      );
      generated.push(disbType);
    }

    return { applicationUuid, generated };
  }

  /**
   * Re-enables KYC selfie: resets selfie / liveness / face-match so the customer can retake
   * the face step. DigiLocker Aadhaar is kept when already captured.
   */
  async enableReKyc(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      include: {
        kyc: true,
        details: {
          select: {
            selectedLoanAmount: true,
            expectedRepaymentDays: true,
          },
        },
        applicationStatus: { select: { name: true } },
        lead: {
          include: {
            leadStatus: { select: { name: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const kyc = application.kyc;
    if (!kyc) {
      throw new BadRequestException('KYC record not found for this application.');
    }

    const customerKyc = await this.prisma.client.customerKyc.findFirst({
      where: { customerId: application.customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        aadhaarData: true,
        aadhaarPhotoPath: true,
      },
    });

    const digilockerDone =
      isDigilockerAadhaarCaptureComplete(customerKyc?.aadhaarData ?? null) ||
      Boolean(customerKyc?.aadhaarPhotoPath?.trim());

    const snapshot = {
      kycStatus: kyc.kycStatus,
      livenessPassed: kyc.livenessPassed,
      livenessCheckCompleted: kyc.isLiveness,
      livenessAttempts: kyc.livenessAttempts,
      livenessCheckedAt: kyc.livenessCheckedAt,
      applicationStatusCode: application.applicationStatus.name,
      leadStatusCode: application.lead.leadStatus.name,
      hasKycArtifacts: Boolean(kyc.livenessSelfiePath?.trim() || customerKyc?.aadhaarPhotoPath?.trim()),
    };

    if (!canEnableReKyc(snapshot)) {
      throw new BadRequestException('This application is not eligible to re-enable KYC selfie.');
    }

    const loanSelectionCompleted = Boolean(
      application.details?.selectedLoanAmount != null &&
        application.details?.expectedRepaymentDays != null,
    );

    const [inProgressLeadStatus, convertedLeadStatus, inReviewAppStatus] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.IN_PROGRESS, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.CONVERTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.IN_REVIEW, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!inProgressLeadStatus) {
      throw new BadRequestException('Lead status IN_PROGRESS is not configured.');
    }

    const recoveryLeadStatus =
      loanSelectionCompleted && convertedLeadStatus ? convertedLeadStatus : inProgressLeadStatus;

    const leadWasInternalError = application.lead.leadStatus.name === LEAD_STATUS.INTERNAL_ERROR;
    const leadWasRejected = application.lead.leadStatus.name === LEAD_STATUS.REJECTED;
    const appWasInternalError = application.applicationStatus.name === APPLICATION_STATUS.INTERNAL_ERROR;
    const appWasKycFailed = application.applicationStatus.name === APPLICATION_STATUS.KYC_FAILED;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.applicationKyc.update({
        where: { applicationId: application.id },
        data: {
          kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: null,
          ...(digilockerDone ? {} : { digilockerAadhaarDownloadAttempts: 0 }),
          livenessSelfiePath: null,
          isLiveness: false,
          livenessCheckedAt: null,
          livenessDoneAt: null,
          livenessPassed: false,
          livenessVendorJson: Prisma.JsonNull,
          livenessVideoPath: null,
          faceMatchCheckedAt: null,
          selfieFaceValidationJson: Prisma.JsonNull,
          selfieFaceValidationPassed: false,
          livenessAttempts: 0,
        },
      });

      await tx.customer.update({
        where: { id: application.customerId },
        data: { kycVerifiedAt: null },
      });

      if (!digilockerDone && customerKyc) {
        await tx.customerKyc.update({
          where: { id: customerKyc.id },
          data: {
            aadhaarVerifiedAt: null,
            aadhaarData: Prisma.JsonNull,
            aadhaarPhotoPath: null,
          },
        });
      }

      if (leadWasInternalError || leadWasRejected) {
        await tx.lead.update({
          where: { id: application.leadId },
          data: {
            leadStatusId: recoveryLeadStatus.id,
            leadStatusNote: null,
            rejectionReasonId: null,
          },
        });
      }

      if ((appWasInternalError || appWasKycFailed) && inReviewAppStatus) {
        await tx.application.update({
          where: { id: application.id },
          data: {
            applicationStatusId: inReviewAppStatus.id,
            rejectionReasonId: null,
          },
        });
      }
    });

    return {
      success: true as const,
      applicationUuid,
      leadUuid: application.lead.uuid,
      digilockerCleared: !digilockerDone,
      digilockerPreserved: digilockerDone,
      leadRecovered: leadWasInternalError || leadWasRejected,
      applicationRecovered: appWasInternalError || appWasKycFailed,
    };
  }

  /**
   * Credit override: bank name did not auto-match, but the account is accepted.
   * Clears the bank-details hold so the customer can continue. Stays IN_REVIEW
   * (including when the rest of the journey is already complete).
   */
  async approveBankNameMatch(applicationUuid: string): Promise<{
    success: true;
    applicationUuid: string;
    statusCode: string;
  }> {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        id: true,
        uuid: true,
        applicationStatus: { select: { name: true } },
        applicationStatusNote: true,
        details: { select: { bankAccountNumber: true, ifscCode: true } },
        bankAccountDetails: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (
      !isBankNameMatchReviewPending({
        statusName: application.applicationStatus.name,
        statusNote: application.applicationStatusNote,
      })
    ) {
      throw new ConflictException('This application is not waiting for a bank name review.');
    }
    if (!application.details?.bankAccountNumber?.trim() || !application.details?.ifscCode?.trim()) {
      throw new BadRequestException('Bank account details are missing; cannot approve the name match.');
    }

    const inReview = await this.prisma.client.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.IN_REVIEW, isActive: true },
      select: { id: true },
    });
    if (!inReview) {
      throw new NotFoundException('IN_REVIEW application status is not configured.');
    }

    const latestAttemptId = application.bankAccountDetails[0]?.id;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: {
          applicationStatusId: inReview.id,
          applicationStatusNote: null,
        },
      });
      if (latestAttemptId) {
        await tx.applicationBankAccountDetail.update({
          where: { id: latestAttemptId },
          data: { status: true },
        });
      }
    });

    return {
      success: true,
      applicationUuid: application.uuid,
      statusCode: APPLICATION_STATUS.IN_REVIEW,
    };
  }

  /**
   * Grants one more penny-drop attempt when the customer has used the configured maximum
   * and is stuck on bank details. Sets attempts used to (allowed - 1) so one try remains.
   */
  async grantPennyDropAttempt(applicationUuid: string): Promise<{
    success: true;
    applicationUuid: string;
    attemptsUsed: number;
    attemptsAllowed: number;
    attemptsRemaining: number;
  }> {
    const [application, attemptsAllowed] = await Promise.all([
      this.prisma.client.application.findUnique({
        where: { uuid: applicationUuid },
        select: {
          id: true,
          uuid: true,
          details: { select: { pennyDropAttempts: true, bankAccountNumber: true, selectedLoanAmount: true } },
          loanAccount: { select: { disbursedAt: true } },
          applicationStatus: { select: { name: true } },
          lead: { select: { id: true, leadStatusNote: true, leadStatus: { select: { name: true } } } },
        },
      }),
      this.loadPennyDropRetryCount(),
    ]);

    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (!application.details) {
      throw new BadRequestException('Application details not found.');
    }

    const attemptsUsed = application.details.pennyDropAttempts ?? 0;
    if (
      !canGrantPennyDropAttempt({
        attemptsUsed,
        attemptsAllowed,
        bankVerified: Boolean(application.details.bankAccountNumber?.trim()),
        disbursed: Boolean(application.loanAccount?.disbursedAt),
        applicationStatusCode: application.applicationStatus.name,
        leadStatusCode: application.lead.leadStatus.name,
      })
    ) {
      throw new BadRequestException('This application is not eligible for another bank verification attempt.');
    }

    const nextAttemptsUsed = Math.max(0, attemptsAllowed - 1);
    const leadWasRejected = application.lead.leadStatus.name === LEAD_STATUS.REJECTED;
    const appWasPennyDropFailed =
      application.applicationStatus.name === APPLICATION_STATUS.PENNYDROP_FAILED;
    const loanSelectionCompleted = application.details.selectedLoanAmount != null;

    const [convertedLeadStatus, inProgressLeadStatus, draftAppStatus] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.CONVERTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.IN_PROGRESS, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.DRAFT, isActive: true },
        select: { id: true },
      }),
    ]);

    const recoveryLeadStatus =
      loanSelectionCompleted && convertedLeadStatus ? convertedLeadStatus : inProgressLeadStatus;

    if (leadWasRejected && !recoveryLeadStatus) {
      throw new BadRequestException('Lead status CONVERTED/IN_PROGRESS is not configured.');
    }
    if (appWasPennyDropFailed && !draftAppStatus) {
      throw new BadRequestException('Application status DRAFT is not configured.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.applicationDetail.update({
        where: { applicationId: application.id },
        data: { pennyDropAttempts: nextAttemptsUsed },
      });
      if (leadWasRejected || application.lead.leadStatusNote?.trim() === BANK_DETAIL_FAILED_NOTE || application.lead.leadStatusNote?.trim() === PENNY_DROP_FAILED_NOTE) {
        await tx.lead.update({
          where: { id: application.lead.id },
          data: {
            ...(recoveryLeadStatus && leadWasRejected ? { leadStatusId: recoveryLeadStatus.id } : {}),
            leadStatusNote: null,
            rejectionReasonId: null,
          },
        });
      }
      if (appWasPennyDropFailed && draftAppStatus) {
        await tx.application.update({
          where: { id: application.id },
          data: {
            applicationStatusId: draftAppStatus.id,
            rejectionReasonId: null,
          },
        });
      }
    });

    return {
      success: true,
      applicationUuid: application.uuid,
      attemptsUsed: nextAttemptsUsed,
      attemptsAllowed,
      attemptsRemaining: Math.max(0, attemptsAllowed - nextAttemptsUsed),
    };
  }

  async markInternalTesting(applicationUuid: string): Promise<{ success: true; applicationUuid: string; leadUuid: string }> {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        uuid: true,
        lead: { select: { id: true, uuid: true, isInternalTesting: true } },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (!application.lead.isInternalTesting) {
      await this.prisma.client.lead.update({
        where: { id: application.lead.id },
        data: { isInternalTesting: true },
      });
    }
    return { success: true, applicationUuid: application.uuid, leadUuid: application.lead.uuid };
  }

  private async loadPennyDropRetryCount(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.PENNY_DROP_RETRY_COUNT.key, isActive: true },
      select: { value: true },
    });
    const n = row ? Number.parseInt(row.value.trim(), 10) : NaN;
    return Number.isFinite(n) && n > 0
      ? n
      : Number.parseInt(SettingKey.PENNY_DROP_RETRY_COUNT.default, 10);
  }

  /** Public CDN/presigned URL, or LOS-authenticated download path when the bucket is private. */
  private resolveBureauReportPdfUrl(
    applicationUuid: string,
    pdfResult: { relativePath: string; publicUrl: string | null } | null,
    hasBureauReport: boolean,
  ): string | null {
    if (!hasBureauReport) return null;
    if (pdfResult?.publicUrl) return pdfResult.publicUrl;
    return `/applications/${applicationUuid}/cibil-report/pdf`;
  }
}

function isStorageObjectMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('NoSuchKey') || msg.includes('S3 GET failed (404)') || msg.includes('S3 HEAD failed (404)');
}

function buildLoanAgreementView(
  details: {
    loanDocumentsAcceptedAt: Date | null;
    loanDocumentsAcceptedIp: string | null;
  } | null,
) {
  if (!details?.loanDocumentsAcceptedAt) {
    return null;
  }
  return {
    documentName: LOAN_DOCUMENT_ACCEPTANCE_NAME,
    signedAt: details.loanDocumentsAcceptedAt.toISOString(),
    ipAddress: details.loanDocumentsAcceptedIp,
  };
}

function toLoanDocumentContext(
  application: {
    id: bigint;
    uuid: string;
    applicationNumber: string;
    details: {
      emailId: string | null;
      emailVerificationType: string | null;
      loanDocumentsAcceptedAt: Date | null;
      loanDocumentsAcceptedIp: string | null;
      keyFactPdfRelativePath: string | null;
      keyFactDisbursementPdfRelativePath?: string | null;
      loanAgreementPdfRelativePath: string | null;
      selectedLoanAmount: { toString(): string } | null;
      interestRate: { toString(): string } | null;
      processingFeePercentage: { toString(): string } | null;
      gstPercentage: { toString(): string } | null;
      expectedRepaymentDays: number | null;
      expectedRepaymentDate: Date | null;
      reasonForLoan: { name: string } | null;
    } | null;
  },
) {
  const details = application.details;
  return {
    id: application.id,
    uuid: application.uuid,
    applicationNumber: application.applicationNumber,
    email: details?.emailId ?? null,
    emailVerificationType: details?.emailVerificationType ?? null,
    loanDocumentsAcceptedAt: details?.loanDocumentsAcceptedAt ?? null,
    loanDocumentsAcceptedIp: details?.loanDocumentsAcceptedIp ?? null,
    keyFactPdfRelativePath: details?.keyFactPdfRelativePath ?? null,
    keyFactDisbursementPdfRelativePath: details?.keyFactDisbursementPdfRelativePath ?? null,
    loanAgreementPdfRelativePath: details?.loanAgreementPdfRelativePath ?? null,
    details: details
      ? {
          ...details,
          keyFactDisbursementPdfRelativePath: details.keyFactDisbursementPdfRelativePath ?? null,
        }
      : null,
  };
}
