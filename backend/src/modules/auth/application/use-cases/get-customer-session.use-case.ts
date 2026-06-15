import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
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
import { KycDigilockerDownloadFailureService } from '../../../../common/kyc/kyc-digilocker-download-failure.service';
import { isKycLivenessOutboundSkipped } from '../../../../common/kyc/kyc-liveness-env.util';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class GetCustomerSessionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsRepository,
    private readonly bureauReports: BureauReportRepository,
    private readonly postBureauOffer: PostBureauOfferService,
    private readonly kycDigilockerDownloadFailure: KycDigilockerDownloadFailureService,
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
      const cooldownDays =
        statusName === LEAD_STATUS.BLACKLISTED
          ? leadPolicy.blacklistDurationDays
          : leadPolicy.reapplyAfterRejectedDays;
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const canReapplyAt = new Date(leadRow.updatedAt.getTime() + cooldownMs);

      if (canReapplyAt.getTime() > Date.now()) {
        rejectedUntil = canReapplyAt.toISOString();
      } else {
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

    let profile = formatLeadDetailForPortal(
      leadRow.leadDetail
        ? {
            ...leadRow.leadDetail,
            panNumber: leadRow.panNumber ?? null,
            panVerified: leadRow.panVerified,
            panVerifiedAt: leadRow.panVerifiedAt,
          }
        : null,
    );

    const [applicationExtras, latestCustomerKyc, leadReferenceRows] = await Promise.all([
      application
        ? this.prisma.client.application.findUnique({
            where: { id: application.id },
            select: {
              updatedAt: true,
              pennyDropAttempts: true,
              details: {
                select: {
                  loanAmount: true,
                  loanTenure: true,
                  loanMaturityDate: true,
                  reasonForLoanId: true,
                },
              },
              disbursement: {
                select: { accountNumber: true, ifscCode: true, bankName: true },
              },
            },
          })
        : Promise.resolve(null),
      this.prisma.client.customerKyc.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kycVerifiedAt: true,
          fullName: true,
          _count: { select: { customerKycDocuments: true } },
        },
      }),
      this.prisma.client.leadReference.findMany({
        where: {
          leadId: leadRow.id,
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
      }),
    ]);

    const appDetails = applicationExtras?.details ?? null;
    const disbursement = applicationExtras?.disbursement ?? null;

    const kycDisplayName = latestCustomerKyc?.fullName?.trim();
    if (profile && kycDisplayName && !profile.fullName?.trim()) {
      profile = { ...profile, fullName: kycDisplayName };
    }

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
      isPanVerifiedFromDb(leadRow.panVerified) || leadRow.panVerified === PAN_VERIFIED.API_DISABLED;
    const detailsCompleted = profileFieldsComplete && panChecksComplete;

    const loanSelectionCompleted = Boolean(
      appDetails?.loanAmount != null &&
        appDetails?.loanTenure != null &&
        appDetails?.reasonForLoanId != null,
    );

    const loanDocumentsCompleted = Boolean(application?.loanDocumentsAcceptedAt);

    const kycDocsCount = latestCustomerKyc?._count.customerKycDocuments ?? 0;
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
      disbursement?.accountNumber?.trim() && disbursement?.ifscCode?.trim(),
    );

    const loanSelection =
      appDetails &&
      (appDetails.loanAmount != null || appDetails.loanTenure != null || appDetails.loanMaturityDate != null)
        ? {
            amountInr: appDetails.loanAmount != null ? appDetails.loanAmount.toString() : null,
            tenureDays: appDetails.loanTenure ?? null,
            maturityDate: appDetails.loanMaturityDate
              ? appDetails.loanMaturityDate.toISOString().slice(0, 10)
              : null,
          }
        : null;

    const digilockerAadhaarDownloadAttempts = await this.kycDigilockerDownloadFailure.readAttemptsUsed(
      leadRow.id,
    );

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
    const pennyDropAttempts = applicationExtras?.pennyDropAttempts ?? 0;
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
