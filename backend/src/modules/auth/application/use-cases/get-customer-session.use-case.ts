import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { getRejectedUntilIso } from '../../../../common/lead/lead-reapply-policy.util';
import {
  APPLICATION_KYC_STATUS,
  APPLICATION_STATUS,
} from '../../../../common/constants/application.constants';
import { isDigilockerAadhaarCaptureComplete } from '../../../../common/kyc/aadhaar-vendor-parse.util';
import {
  formatLeadDetailForPortal,
  isLeadEmailVerifiedForPortal,
  isPanVerifiedFromDb,
} from '../../../../common/mappers/customer-portal-profile.mapper';
import { PAN_VERIFIED } from '../../../../common/constants/pan-verification.constants';
import { isCibilNewToCreditScore } from '../../../../common/vendor/tenacio-bureau-payload.mapper';
import type { CustomerSessionResult } from '../contracts/customer-session-result.contract';
import { PostBureauOfferService } from '../services/post-bureau-offer.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { BureauReportRepository } from '../../infrastructure/repositories/bureau-report.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS } from '../../../../common/constants/kyc.constants';
import { isKycLivenessOutboundSkipped } from '../../../../common/kyc/kyc-liveness-env.util';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';

function countUploadedKycDocuments(aadhaarData: unknown): number {
  if (!aadhaarData || typeof aadhaarData !== 'object' || Array.isArray(aadhaarData)) {
    return 0;
  }
  const docs = (aadhaarData as { uploadedDocuments?: unknown }).uploadedDocuments;
  return Array.isArray(docs) ? docs.length : 0;
}

@Injectable()
export class GetCustomerSessionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsRepository,
    private readonly bureauReports: BureauReportRepository,
    private readonly postBureauOffer: PostBureauOfferService,
  ) {}

  async execute(req: Request): Promise<CustomerSessionResult> {
    const logger = new Logger(GetCustomerSessionUseCase.name);
    const session = req.customerSession;
    if (!session) {
      return { authenticated: false };
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      return { authenticated: false };
    }

    const noLeadResult = {
      authenticated: true as const,
      customerId: customer.uuid,
      mobileNumber: customer.mobileNumber,
      lead: null,
      profile: null,
      journey: {
        detailsCompleted: false,
        loanSelectionCompleted: false,
        loanDocumentsCompleted: false,
        kycCompleted: false,
        referencesCompleted: false,
        bankDetailsCompleted: false,
      },
      loanSelection: null,
      leadReferences: [],
      kycFaceProgress: null,
      bankVerificationProgress: null,
    };

    let leadRow = await this.leads.findActiveByCustomerId(customer.id);
    
    if (!leadRow) {
      return noLeadResult;
    }

    // leadRow = await this.syncOfferEligibilityForLead(leadRow, customer.id);
    // if (!leadRow) {
    //   return noLeadResult;
    // }

    let statusName = leadRow.leadStatus.name;

    if (statusName === LEAD_STATUS.CONVERTED) {
      const disbursedApp = await this.prisma.client.application.findFirst({
        where: {
          leadId: leadRow.id,
          applicationStatus: { name: APPLICATION_STATUS.DISBURSED, isActive: true },
        },
        select: { id: true },
      });

      if (disbursedApp) {
        await this.leads.deactivate(leadRow.id);
        return noLeadResult;
      }
    }

    // REJECTED or BLACKLISTED → compute rejectedUntil based on the applicable cooldown.
    let rejectedUntil: string | null = null;
    if (statusName === LEAD_STATUS.REJECTED || statusName === LEAD_STATUS.BLACKLISTED) {
      const leadPolicy = await this.settings.loadCustomerLeadPolicySettings();
      rejectedUntil = getRejectedUntilIso(leadRow, leadPolicy);

      if (!rejectedUntil) {
        await this.leads.deactivate(leadRow.id);
        return noLeadResult;
      }
    }

    const application = await fetchLatestApplicationKycSnapshot(this.prisma.client, {
      leadId: leadRow.id,
    });

    logger.debug("application", application);

    const emailVerified = isLeadEmailVerifiedForPortal(
      statusName,
      application?.email ?? null,
      application?.emailVerificationType ?? null,
    );

    logger.debug("emailVerified", emailVerified);

    let profile = formatLeadDetailForPortal(leadRow.leadDetail);

    const [applicationExtras, latestCustomerKyc, leadReferenceRows] = await Promise.all([
      application
        ? this.prisma.client.application.findUnique({
            where: { id: application.id },
            select: {
              updatedAt: true,
              details: {
                select: {
                  pennyDropAttempts: true,
                  selectedLoanAmount: true,
                  reasonForLoanId: true,
                  expectedRepaymentDays: true,
                  expectedRepaymentDate: true,
                  bankAccountNumber: true,
                  ifscCode: true,
                  bankName: true,
                },
              },
              loanAccount: {
                select: {
                  disbursedAt: true,
                  loanMaturityDate: true,
                  loanAccountNumber: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      this.prisma.client.customerKyc.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        select: {
          aadhaarData: true,
        },
      }),
      application
        ? this.prisma.client.applicationReference.findMany({
            where: {
              applicationId: application.id,
              fullName: { not: '' },
              mobileNumber: { not: '' },
            },
            orderBy: { referenceIndex: 'asc' },
            select: {
              referenceIndex: true,
              fullName: true,
              mobileNumber: true,
              relationId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const appDetails = applicationExtras?.details ?? null;
    const loanAccount = applicationExtras?.loanAccount ?? null;

    const profileFieldsComplete = Boolean(
      profile?.fullName?.trim() &&
        profile?.dob?.trim() &&
        profile?.gender &&
        profile?.occupation &&
        profile?.addressLine1?.trim() &&
        profile?.currentCity?.trim() &&
        profile?.pincode?.trim() &&
        profile?.creditConsentAccepted,
    );
    const panChecksComplete =
      isPanVerifiedFromDb(leadRow.leadDetail?.panVerified) ||
      leadRow.leadDetail?.panVerified === PAN_VERIFIED.API_DISABLED;
    const detailsCompleted = profileFieldsComplete && panChecksComplete;

    const loanSelectionCompleted = Boolean(
      appDetails?.selectedLoanAmount != null &&
        appDetails?.expectedRepaymentDays != null &&
        appDetails?.reasonForLoanId != null,
    );

    const loanDocumentsCompleted = Boolean(application?.loanDocumentsAcceptedAt);

    const kycDocsCount = countUploadedKycDocuments(latestCustomerKyc?.aadhaarData);
    const livenessOutboundSkipped = isKycLivenessOutboundSkipped();
    const hasSavedSelfie = Boolean(application?.selfieRelativePath?.trim());
    const hasDigilockerForm = isDigilockerAadhaarCaptureComplete(application?.digilockerAadhaarFormJson ?? null);
    /** Outbound Tenacio liveness can be skipped by env; DigiLocker + a stored selfie are always required for this path. */
    const faceStepCompleteForJourney = Boolean(
      application &&
        hasDigilockerForm &&
        hasSavedSelfie &&
        (application.livenessPassed === true || livenessOutboundSkipped),
    );

    const kycCompleted = Boolean(
      faceStepCompleteForJourney ||
        (application?.kycStatus === APPLICATION_KYC_STATUS.COMPLETED &&
          hasDigilockerForm &&
          hasSavedSelfie) ||
        (latestCustomerKyc && kycDocsCount >= 3),
    );

    const leadReferences = leadReferenceRows.map((row) => ({
      referenceIndex: row.referenceIndex,
      fullName: row.fullName,
      mobileNumber: row.mobileNumber,
      relationId: row.relationId,
    }));
    const referencesCompleted = leadReferences.length >= 2;

    const bankDetailsCompleted = Boolean(
      appDetails?.bankAccountNumber?.trim() && appDetails?.ifscCode?.trim(),
    );

    const loanSelection =
      appDetails &&
      (appDetails.selectedLoanAmount != null ||
        appDetails.expectedRepaymentDays != null ||
        appDetails.expectedRepaymentDate != null)
        ? {
            amountInr:
              appDetails.selectedLoanAmount != null ? appDetails.selectedLoanAmount.toString() : null,
            tenureDays: appDetails.expectedRepaymentDays ?? null,
            maturityDate: loanAccount?.loanMaturityDate
              ? loanAccount.loanMaturityDate.toISOString().slice(0, 10)
              : appDetails.expectedRepaymentDate
                ? appDetails.expectedRepaymentDate.toISOString().slice(0, 10)
                : null,
          }
        : null;

    const digilockerAadhaarDownloadAttempts =
      application != null
        ? (
            await this.prisma.client.applicationKyc.findUnique({
              where: { applicationId: application.id },
              select: { digilockerAadhaarDownloadAttempts: true },
            })
          )?.digilockerAadhaarDownloadAttempts ?? 0
        : 0;

    const kycFaceProgress =
      application != null
        ? {
            applicationKycStatus: application.kycStatus,
            digilockerAadhaarCaptured: isDigilockerAadhaarCaptureComplete(
              application.digilockerAadhaarFormJson,
            ),
            selfieCaptured: Boolean(application.selfieRelativePath?.trim()),
            livenessPassed: application.livenessPassed === true,
            livenessRequired: !livenessOutboundSkipped,
            digilockerAadhaarForm: application.digilockerAadhaarFormJson ?? null,
            digilockerAadhaarPhotoUrl: application.aadhaarPhotoRelativePath?.trim()
              ? '/auth/kyc/digilocker-aadhaar-photo'
              : null,
            kycSelfiePhotoUrl: application.selfieRelativePath?.trim() ? '/auth/kyc/selfie-photo' : null,
            selfieUpdatedAt:
              application.selfieRelativePath?.trim() && applicationExtras?.updatedAt
                ? applicationExtras.updatedAt.toISOString()
                : null,
            digilockerAadhaarDownloadAttempts,
            digilockerAadhaarDownloadMaxAttempts: DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS,
          }
        : null;

    const pennyDropRetryCount = await this.settings.loadPennyDropRetryCount();
    const pennyDropAttempts = applicationExtras?.details?.pennyDropAttempts ?? 0;
    const bankVerificationProgress =
      application && kycCompleted && !bankDetailsCompleted
        ? {
            attemptsUsed: pennyDropAttempts,
            attemptsAllowed: pennyDropRetryCount,
            retryLimitReached: pennyDropAttempts >= pennyDropRetryCount,
          }
        : null;

    return {
      authenticated: true,
      customerId: customer.uuid,
      mobileNumber: customer.mobileNumber,
      lead: {
        uuid: leadRow.uuid,
        status: statusName,
        email: application?.email ?? null,
        emailVerified,
        rejectedUntil,
      },
      profile,
      journey: {
        detailsCompleted,
        loanSelectionCompleted,
        loanDocumentsCompleted,
        kycCompleted,
        referencesCompleted,
        bankDetailsCompleted,
      },
      loanSelection,
      leadReferences,
      kycFaceProgress,
      bankVerificationProgress,
    };
  }

  /**
   * When bureau score is new-to-credit (0 / -1) but post-BRE rejection was missed,
   * apply it now so the portal session and journey routing stay consistent.
   */
  private async syncOfferEligibilityForLead(
    leadRow: NonNullable<Awaited<ReturnType<LeadRepository['findActiveByCustomerId']>>>,
    customerId: bigint,
  ) {
    const statusName = leadRow.leadStatus.name;
    if (statusName === LEAD_STATUS.REJECTED || statusName === LEAD_STATUS.BLACKLISTED) {
      return leadRow;
    }

    // const cibilScore = await this.bureauReports.findLatestBureauScoreForLead(leadRow.id);
    // Logger.debug("cibilScore", cibilScore);
    // if (!isCibilNewToCreditScore(cibilScore)) {
    //   return leadRow;
    // }

    const offerResult = await this.postBureauOffer.runAfterSuccessfulBureauFetch({
      leadId: leadRow.id,
      customerId,
      leadUuid: leadRow.uuid,
    });

    if (offerResult.ok) {
      return leadRow;
    }

    return this.leads.findActiveByCustomerId(customerId);
  }
}
