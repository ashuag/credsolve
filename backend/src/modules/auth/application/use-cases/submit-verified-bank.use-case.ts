import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { BANK_NAME_REVIEW_NOTE, PENNY_DROP_FAILED_NOTE } from '../../../../common/constants/bank.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { SmsService } from '../../../../common/sms/sms.service';
import { BankTenacioVendorService } from '../../../../common/vendor/bank-tenacio-vendor.service';
import {
  isPennyDropInvalidInputOrAttemptLimit,
  pennyDropVendorFailMessage,
} from '../../../../common/vendor/penny-drop-vendor.util';
import {
  isTenacioVendorBusinessSuccess,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { compareJourneyNameToPennyDrop, extractPennyDropBankName } from '../../../../common/kyc/penny-drop-name-match.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { SubmitVerifiedBankDto } from '../dto/submit-verified-bank.dto';

export type SubmitVerifiedBankResult = {
  success: boolean;
  pennyDropOk: boolean;
  applicationStatus: string | null;
  message?: string;
  vendor: unknown | null;
  attemptsUsed: number;
  attemptsAllowed: number;
  retryLimitReached: boolean;
  nameMatchScore?: number | null;
  nameMatchPendingReview?: boolean;
};

@Injectable()
export class SubmitVerifiedBankUseCase {
  private readonly logger = new Logger(SubmitVerifiedBankUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly bankVendor: BankTenacioVendorService,
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly settings: SettingsRepository,
  ) {}

  async execute(req: Request, dto: SubmitVerifiedBankDto): Promise<SubmitVerifiedBankResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
    if (!lead) {
      throw new NotFoundException('No active lead found.');
    }

    const leadWithDetail = await this.prisma.client.lead.findFirst({
      where: { id: lead.id, isActive: true },
      select: {
        id: true,
        leadDetail: { select: { fullName: true } },
      },
    });

    const holderName = leadWithDetail?.leadDetail?.fullName?.trim() ?? '';
    if (!holderName) {
      throw new BadRequestException('Complete your full name in personal details before submitting bank information.');
    }

    const mobileDigits = customer.mobileNumber.replace(/\D/g, '').slice(-10);
    if (mobileDigits.length < 10) {
      throw new BadRequestException('A valid 10-digit mobile number is required for bank verification.');
    }

    const accountNumber = dto.accountNumber.replace(/\D/g, '');
    const confirmAccountNumber = dto.confirmAccountNumber.replace(/\D/g, '');
    if (accountNumber !== confirmAccountNumber) {
      throw new BadRequestException('Account number and confirmation do not match.');
    }
    const ifsc = dto.ifscCode.trim().toUpperCase();
    const verifiedBankName = dto.verifiedBankName?.trim() ?? '';

    const attemptsAllowed = await this.settings.loadPennyDropRetryCount();
    const nameMatchMinScore = await this.settings.loadPennyDropNameMatchMinScore();
    const applicationRow = await this.prisma.client.application.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        applicationStatus: { select: { name: true } },
        details: { select: { pennyDropAttempts: true } },
      },
    });
    if (!applicationRow) {
      throw new BadRequestException('Create application details before bank details.');
    }

    if (applicationRow.applicationStatus.name === APPLICATION_STATUS.UNDER_REVIEW) {
      return {
        success: true,
        pennyDropOk: true,
        applicationStatus: APPLICATION_STATUS.UNDER_REVIEW,
        message:
          'Your bank account is under credit review. You can continue once credit approves the name match.',
        vendor: null,
        attemptsUsed: applicationRow.details?.pennyDropAttempts ?? 0,
        attemptsAllowed,
        retryLimitReached: false,
        nameMatchPendingReview: true,
      };
    }

    const attemptsUsed = applicationRow.details?.pennyDropAttempts ?? 0;
    if (attemptsUsed >= attemptsAllowed) {
      const applicationStatus = await this.markPennyDropFailed({
        applicationId: applicationRow.id,
        leadId: lead.id,
        customerMobile: customer.mobileNumber,
      });
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus,
        vendor: null,
        attemptsUsed,
        attemptsAllowed,
        retryLimitReached: true,
      };
    }

    const pennyOut = await this.bankVendor.postPennyDrop(
      {
        input: {
          mobileNumber: mobileDigits,
          bankAccountNumber: accountNumber,
          ifscNumber: ifsc,
          name: holderName,
          consent: true,
        },
      },
      lead.id,
    );

    if (!pennyOut.configured) {
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus: null,
        message: pennyOut.skipReason ?? 'Bank verification is not configured.',
        vendor: pennyOut.vendorBody ?? null,
        attemptsUsed,
        attemptsAllowed,
        retryLimitReached: false,
      };
    }

    const vendor = pennyOut.vendorBody ?? null;
    const pennyOk = pennyOut.ok && isTenacioVendorBusinessSuccess(vendor);

    if (!pennyOk) {
      const nextAttemptsUsed = attemptsUsed + 1;
      await this.prisma.client.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.applicationDetail.update({
          where: { applicationId: applicationRow.id },
          data: {
            pennyDropAttempts: nextAttemptsUsed,
            pennyDropVendorJson:
              vendor === null ? Prisma.JsonNull : (vendor as Prisma.InputJsonValue),
          },
        });
        await this.recordBankAccountAttempt(tx, {
          applicationId: applicationRow.id,
          accountNumber,
          ifsc,
          bankName: verifiedBankName,
          accountHolderName: holderName,
          nameAtBank: extractPennyDropBankName(vendor),
          nameMatchScore: null,
          matched: false,
          vendor,
        });
      });
      const retryLimitReached = nextAttemptsUsed >= attemptsAllowed;
      const terminal =
        retryLimitReached || isPennyDropInvalidInputOrAttemptLimit(vendor);
      const applicationStatus = terminal
        ? await this.markPennyDropFailed({
            applicationId: applicationRow.id,
            leadId: lead.id,
            customerMobile: customer.mobileNumber,
          })
        : null;
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus,
        message: terminal
          ? undefined
          : pennyDropVendorFailMessage(vendor) ??
            'Bank verification failed. Please check your account details and try again.',
        vendor,
        attemptsUsed: nextAttemptsUsed,
        attemptsAllowed,
        retryLimitReached,
      };
    }

    const nameMatch = compareJourneyNameToPennyDrop({
      journeyFullName: holderName,
      vendor,
    });
    const autoPass =
      nameMatch.matched ||
      (nameMatch.score != null &&
        nameMatch.score >= nameMatchMinScore &&
        !(nameMatch.matched === false && nameMatch.reason === 'vendor_name_mismatch'));

    if (!autoPass) {
      if (nameMatch.bankName) {
        return this.persistUnderReviewNameMismatch({
          leadId: lead.id,
          applicationId: applicationRow.id,
          customerMobile: customer.mobileNumber,
          accountNumber,
          ifsc,
          verifiedBankName,
          holderName,
          vendor,
          nameMatchScore: nameMatch.score,
          bankNameAtVendor: nameMatch.bankName,
          attemptsUsed,
          attemptsAllowed,
        });
      }

      const nextAttemptsUsed = attemptsUsed + 1;
      await this.prisma.client.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.applicationDetail.update({
          where: { applicationId: applicationRow.id },
          data: {
            pennyDropAttempts: nextAttemptsUsed,
            pennyDropVendorJson:
              vendor === null ? Prisma.JsonNull : (vendor as Prisma.InputJsonValue),
          },
        });
        await this.recordBankAccountAttempt(tx, {
          applicationId: applicationRow.id,
          accountNumber,
          ifsc,
          bankName: verifiedBankName,
          accountHolderName: holderName,
          nameAtBank: nameMatch.bankName,
          nameMatchScore: nameMatch.score,
          matched: false,
          vendor,
        });
      });
      const retryLimitReached = nextAttemptsUsed >= attemptsAllowed;
      this.logger.warn(
        `[penny-drop] Name mismatch lead=${lead.id.toString()} reason=${nameMatch.matched ? 'matched' : nameMatch.reason} ` +
          `bankName=${nameMatch.bankName ? '[present]' : '[missing]'} score=${nameMatch.score ?? 'n/a'}`,
      );
      const applicationStatus = retryLimitReached
        ? await this.markPennyDropFailed({
            applicationId: applicationRow.id,
            leadId: lead.id,
            customerMobile: customer.mobileNumber,
          })
        : null;
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus,
        message: retryLimitReached
          ? undefined
          : 'Bank verification failed: account holder name does not match.',
        vendor,
        attemptsUsed: nextAttemptsUsed,
        attemptsAllowed,
        retryLimitReached,
        nameMatchScore: nameMatch.score,
      };
    }

    const appStatuses = await this.prisma.client.applicationStatus.findMany({
      where: {
        name: { in: [APPLICATION_STATUS.IN_REVIEW] },
        isActive: true,
      },
      select: { id: true, name: true },
    });
    const inReview = appStatuses.find((s: { id: number; name: string }) => s.name === APPLICATION_STATUS.IN_REVIEW);
    if (!inReview) {
      throw new BadRequestException('Application status IN_REVIEW is not configured.');
    }

    let statusAfter = APPLICATION_STATUS.IN_REVIEW;

    await this.prisma.client.$transaction(async (tx: Prisma.TransactionClient) => {
      const application = await tx.application.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, applicationStatusId: true },
      });
      if (!application) {
        throw new BadRequestException('Create loan details before bank details.');
      }

      await tx.applicationDetail.updateMany({
        where: { applicationId: application.id },
        data: {
          bankAccountNumber: accountNumber,
          ifscCode: ifsc,
          bankName: verifiedBankName.length > 0 ? verifiedBankName : null,
          pennyDropVendorJson:
            vendor === null ? Prisma.JsonNull : (vendor as Prisma.InputJsonValue),
        },
      });

      await this.recordBankAccountAttempt(tx, {
        applicationId: application.id,
        accountNumber,
        ifsc,
        bankName: verifiedBankName,
        accountHolderName: holderName,
        nameAtBank: nameMatch.bankName,
        nameMatchScore: nameMatch.score,
        matched: true,
        vendor,
      });

      await tx.application.update({
        where: { id: application.id },
        data: { applicationStatusId: inReview.id },
      });
    });

    void this.sms.sendUnderReviewSms(customer.mobileNumber, lead.id).catch((err) => {
      this.logger.error('Failed to send under-review SMS', err instanceof Error ? err.stack : err);
    });

    return {
      success: true,
      pennyDropOk: true,
      applicationStatus: statusAfter,
      vendor,
      attemptsUsed,
      attemptsAllowed,
      retryLimitReached: false,
      nameMatchScore: nameMatch.score,
      nameMatchPendingReview: false,
    };
  }

  private async persistUnderReviewNameMismatch(params: {
    leadId: bigint;
    applicationId: bigint;
    customerMobile: string;
    accountNumber: string;
    ifsc: string;
    verifiedBankName: string;
    holderName: string;
    vendor: unknown;
    nameMatchScore: number | null;
    bankNameAtVendor: string;
    attemptsUsed: number;
    attemptsAllowed: number;
  }): Promise<SubmitVerifiedBankResult> {
    const underReview = await this.prisma.client.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.UNDER_REVIEW, isActive: true },
      select: { id: true },
    });
    if (!underReview) {
      throw new BadRequestException('Application status UNDER_REVIEW is not configured.');
    }

    this.logger.warn(
      `[penny-drop] Name mismatch sent to credit review lead=${params.leadId.toString()} ` +
        `score=${params.nameMatchScore ?? 'n/a'}`,
    );

    await this.prisma.client.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.applicationDetail.updateMany({
        where: { applicationId: params.applicationId },
        data: {
          bankAccountNumber: params.accountNumber,
          ifscCode: params.ifsc,
          bankName: params.verifiedBankName.length > 0 ? params.verifiedBankName : null,
          pennyDropVendorJson:
            params.vendor === null ? Prisma.JsonNull : (params.vendor as Prisma.InputJsonValue),
        },
      });

      await this.recordBankAccountAttempt(tx, {
        applicationId: params.applicationId,
        accountNumber: params.accountNumber,
        ifsc: params.ifsc,
        bankName: params.verifiedBankName,
        accountHolderName: params.holderName,
        nameAtBank: params.bankNameAtVendor,
        nameMatchScore: params.nameMatchScore,
        matched: false,
        vendor: params.vendor,
      });

      await tx.application.update({
        where: { id: params.applicationId },
        data: {
          applicationStatusId: underReview.id,
          applicationStatusNote: BANK_NAME_REVIEW_NOTE,
        },
      });
    });

    void this.sms.sendUnderReviewSms(params.customerMobile, params.leadId).catch((err) => {
      this.logger.error('Failed to send under-review SMS', err instanceof Error ? err.stack : err);
    });

    return {
      success: true,
      pennyDropOk: true,
      applicationStatus: APPLICATION_STATUS.UNDER_REVIEW,
      message:
        'Your bank account was verified, but the account name needs a credit review before you can continue.',
      vendor: params.vendor,
      attemptsUsed: params.attemptsUsed,
      attemptsAllowed: params.attemptsAllowed,
      retryLimitReached: false,
      nameMatchScore: params.nameMatchScore,
      nameMatchPendingReview: true,
    };
  }

  /**
   * Same pattern as KYC_FAILED: reject the lead, set application PENNYDROP_FAILED,
   * and send the rejection SMS. Customer portal then shows /thank-you-interest.
   */
  private async markPennyDropFailed(params: {
    applicationId: bigint;
    leadId: bigint;
    customerMobile: string;
  }): Promise<string | null> {
    const application = await this.prisma.client.application.findUnique({
      where: { id: params.applicationId },
      select: {
        applicationStatus: { select: { name: true } },
        lead: {
          select: {
            leadStatus: { select: { name: true } },
            leadStatusNote: true,
          },
        },
      },
    });
    if (!application) return null;

    const currentStatus = application.applicationStatus.name;
    if (
      currentStatus === APPLICATION_STATUS.PENNYDROP_FAILED &&
      application.lead.leadStatus.name === LEAD_STATUS.REJECTED
    ) {
      return APPLICATION_STATUS.PENNYDROP_FAILED;
    }

    const [rejectedLeadStatus, pennyFailedAppStatus, pennyFailedReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.PENNYDROP_FAILED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.rejectionReason.findFirst({
        where: { name: REJECTION_REASON.PENNYDROP_FAILED, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!rejectedLeadStatus) {
      this.logger.warn('LeadStatus REJECTED not found — skipping penny-drop rejection.');
      return currentStatus;
    }
    if (!pennyFailedAppStatus) {
      this.logger.warn(
        `ApplicationStatus ${APPLICATION_STATUS.PENNYDROP_FAILED} not found — run seed; skipping application status update.`,
      );
    }

    const alreadyRejected = application.lead.leadStatus.name === LEAD_STATUS.REJECTED;

    await this.prisma.client.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.lead.update({
        where: { id: params.leadId },
        data: {
          leadStatusId: rejectedLeadStatus.id,
          leadStatusNote: PENNY_DROP_FAILED_NOTE,
          ...(pennyFailedReason ? { rejectionReasonId: pennyFailedReason.id } : {}),
        },
      });

      const canSetAppStatus =
        currentStatus === APPLICATION_STATUS.DRAFT ||
        currentStatus === APPLICATION_STATUS.IN_REVIEW ||
        currentStatus === APPLICATION_STATUS.UNDER_REVIEW ||
        currentStatus === APPLICATION_STATUS.PENNYDROP_FAILED;
      if (pennyFailedAppStatus && canSetAppStatus) {
        await tx.application.update({
          where: { id: params.applicationId },
          data: {
            applicationStatusId: pennyFailedAppStatus.id,
            ...(pennyFailedReason ? { rejectionReasonId: pennyFailedReason.id } : {}),
          },
        });
      }
    });

    if (!alreadyRejected) {
      void this.sms.sendRejectionSms(params.customerMobile, params.leadId).catch((err) => {
        this.logger.error('Failed to send rejection SMS', err instanceof Error ? err.stack : err);
      });
    }

    return pennyFailedAppStatus ? APPLICATION_STATUS.PENNYDROP_FAILED : currentStatus;
  }

  /**
   * Insert one penny-drop attempt. When matched, also copy bank fields onto
   * `loan_account` if that row already exists (disbursed applications).
   */
  private async recordBankAccountAttempt(
    tx: Prisma.TransactionClient,
    params: {
      applicationId: bigint;
      accountNumber: string;
      ifsc: string;
      bankName: string;
      accountHolderName: string;
      nameAtBank: string | null;
      nameMatchScore: number | null;
      matched: boolean;
      vendor: unknown;
    },
  ): Promise<void> {
    const bankName = params.bankName.trim().slice(0, 100);
    const accountHolderName = params.accountHolderName.trim().slice(0, 100);
    const nameAtBank = params.nameAtBank?.trim().slice(0, 150) ?? '';

    await tx.applicationBankAccountDetail.create({
      data: {
        applicationId: params.applicationId,
        bankAccountNumber: params.accountNumber,
        ifscCode: params.ifsc,
        bankName: bankName.length > 0 ? bankName : null,
        accountHolderName: accountHolderName.length > 0 ? accountHolderName : null,
        nameAtBank: nameAtBank.length > 0 ? nameAtBank : null,
        nameMatchScore: params.nameMatchScore,
        status: params.matched,
        pennyDropVendorJson:
          params.vendor === null ? Prisma.JsonNull : (params.vendor as Prisma.InputJsonValue),
      },
    });

    if (!params.matched) return;

    await tx.loanAccount.updateMany({
      where: { applicationId: params.applicationId },
      data: {
        bankAccountNumber: params.accountNumber,
        ifscCode: params.ifsc,
      },
    });
  }
}
