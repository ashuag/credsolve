import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import {
  BANK_DETAIL_FAILED_NOTE,
  BANK_NAME_REVIEW_NOTE,
  isBankNameMatchReviewPending,
  PENNY_DROP_FAILED_NOTE,
} from '../../../common/constants/bank.constants';
import { SettingKey } from '../../../common/constants/setting.constants';
import { isTenacioVendorBusinessSuccess } from '../../../common/kyc/aadhaar-vendor-parse.util';
import {
  compareJourneyNameToPennyDrop,
  extractPennyDropBankName,
} from '../../../common/kyc/penny-drop-name-match.util';
import { BankTenacioVendorService } from '../../../common/vendor/bank-tenacio-vendor.service';
import { pennyDropVendorFailMessage } from '../../../common/vendor/penny-drop-vendor.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { canRecheckPennyDrop } from '../penny-drop-grant-retry.util';

export type RecheckPennyDropResult = {
  success: true;
  applicationUuid: string;
  pennyDropOk: boolean;
  nameMatchScore: number | null;
  nameMatchPendingReview: boolean;
  applicationStatus: string;
  message: string;
};

@Injectable()
export class LosPennyDropRecheckService {
  private readonly logger = new Logger(LosPennyDropRecheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankVendor: BankTenacioVendorService,
  ) {}

  /**
   * Re-run penny drop on the last submitted account. Does not consume a customer attempt.
   */
  async recheck(applicationUuid: string): Promise<RecheckPennyDropResult> {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        id: true,
        uuid: true,
        applicationStatusNote: true,
        applicationStatus: { select: { name: true } },
        customer: { select: { mobileNumber: true } },
        lead: {
          select: {
            id: true,
            leadStatusNote: true,
            leadStatus: { select: { name: true } },
            leadDetail: { select: { fullName: true } },
          },
        },
        details: {
          select: { bankAccountNumber: true, ifscCode: true, bankName: true },
        },
        loanAccount: { select: { disbursedAt: true } },
        bankAccountDetails: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true,
            status: true,
          },
        },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const latestAttempt = application.bankAccountDetails[0] ?? null;
    const accountNumber = (
      latestAttempt?.bankAccountNumber ||
      application.details?.bankAccountNumber ||
      ''
    )
      .replace(/\D/g, '')
      .trim();
    const ifsc = (latestAttempt?.ifscCode || application.details?.ifscCode || '').trim().toUpperCase();
    const bankName = (latestAttempt?.bankName || application.details?.bankName || '').trim();
    const holderName = application.lead.leadDetail?.fullName?.trim() ?? '';
    const nameMatchPendingReview = isBankNameMatchReviewPending({
      statusName: application.applicationStatus.name,
      statusNote: application.applicationStatusNote,
    });

    if (
      !canRecheckPennyDrop({
        hasAccountToRecheck: Boolean(accountNumber && ifsc),
        bankVerified: Boolean(application.details?.bankAccountNumber?.trim()),
        nameMatchPendingReview,
        latestAttemptMatched: latestAttempt ? latestAttempt.status : null,
        disbursed: Boolean(application.loanAccount?.disbursedAt),
        applicationStatusCode: application.applicationStatus.name,
        leadStatusCode: application.lead.leadStatus.name,
      })
    ) {
      throw new BadRequestException('This application is not eligible for a penny-drop recheck.');
    }
    if (!holderName) {
      throw new BadRequestException('Customer full name is missing; cannot recheck penny drop.');
    }

    const mobileDigits = application.customer.mobileNumber.replace(/\D/g, '').slice(-10);
    if (mobileDigits.length < 10) {
      throw new BadRequestException('A valid 10-digit mobile number is required for bank verification.');
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
      application.lead.id,
    );
    if (!pennyOut.configured) {
      throw new BadRequestException(pennyOut.skipReason ?? 'Bank verification is not configured.');
    }

    const vendor = pennyOut.vendorBody ?? null;
    const pennyOk = pennyOut.ok && isTenacioVendorBusinessSuccess(vendor);
    const currentStatus = application.applicationStatus.name;

    if (!pennyOk) {
      await this.recordAttempt({
        applicationId: application.id,
        accountNumber,
        ifsc,
        bankName,
        accountHolderName: holderName,
        nameAtBank: extractPennyDropBankName(vendor),
        nameMatchScore: null,
        matched: false,
        vendor,
      });
      return {
        success: true,
        applicationUuid: application.uuid,
        pennyDropOk: false,
        nameMatchScore: null,
        nameMatchPendingReview,
        applicationStatus: currentStatus,
        message:
          pennyDropVendorFailMessage(vendor) ??
          'Penny drop failed again. The previous application status is unchanged.',
      };
    }

    const nameMatchMinScore = await this.loadNameMatchMinScore();
    const nameMatch = compareJourneyNameToPennyDrop({ journeyFullName: holderName, vendor });
    const autoPass =
      nameMatch.matched || (nameMatch.score != null && nameMatch.score >= nameMatchMinScore);

    if (!autoPass) {
      const statusAfter = await this.persistNameMismatch({
        applicationId: application.id,
        leadId: application.lead.id,
        currentStatus,
        accountNumber,
        ifsc,
        bankName,
        holderName,
        vendor,
        nameMatchScore: nameMatch.score,
        bankNameAtVendor: nameMatch.bankName,
      });
      return {
        success: true,
        applicationUuid: application.uuid,
        pennyDropOk: true,
        nameMatchScore: nameMatch.score,
        nameMatchPendingReview: true,
        applicationStatus: statusAfter,
        message: `Penny drop succeeded. Name match is ${nameMatch.score ?? 'n/a'}% and stays in credit review.`,
      };
    }

    const statusAfter = await this.persistMatched({
      applicationId: application.id,
      leadId: application.lead.id,
      leadStatusNote: application.lead.leadStatusNote,
      currentStatus,
      accountNumber,
      ifsc,
      bankName,
      holderName,
      vendor,
      nameMatchScore: nameMatch.score,
      bankNameAtVendor: nameMatch.bankName,
    });

    return {
      success: true,
      applicationUuid: application.uuid,
      pennyDropOk: true,
      nameMatchScore: nameMatch.score,
      nameMatchPendingReview: false,
      applicationStatus: statusAfter,
      message: `Penny drop passed. Name match is ${nameMatch.score ?? 'n/a'}%.`,
    };
  }

  private canMoveToInReview(currentStatus: string): boolean {
    return (
      currentStatus === APPLICATION_STATUS.DRAFT ||
      currentStatus === APPLICATION_STATUS.PENNYDROP_FAILED ||
      currentStatus === APPLICATION_STATUS.UNDER_REVIEW ||
      currentStatus === APPLICATION_STATUS.IN_REVIEW
    );
  }

  private async persistMatched(params: {
    applicationId: bigint;
    leadId: bigint;
    leadStatusNote: string | null;
    currentStatus: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    holderName: string;
    vendor: unknown;
    nameMatchScore: number | null;
    bankNameAtVendor: string | null;
  }): Promise<string> {
    const moveToReview = this.canMoveToInReview(params.currentStatus);
    const inReview = moveToReview ? await this.requireInReviewStatus() : null;
    const clearLeadNote =
      params.leadStatusNote?.trim() === BANK_DETAIL_FAILED_NOTE ||
      params.leadStatusNote?.trim() === PENNY_DROP_FAILED_NOTE;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.applicationDetail.updateMany({
        where: { applicationId: params.applicationId },
        data: {
          bankAccountNumber: params.accountNumber,
          ifscCode: params.ifsc,
          bankName: params.bankName.length > 0 ? params.bankName : null,
          pennyDropVendorJson:
            params.vendor === null ? Prisma.JsonNull : (params.vendor as Prisma.InputJsonValue),
        },
      });
      await this.insertAttempt(tx, {
        applicationId: params.applicationId,
        accountNumber: params.accountNumber,
        ifsc: params.ifsc,
        bankName: params.bankName,
        accountHolderName: params.holderName,
        nameAtBank: params.bankNameAtVendor,
        nameMatchScore: params.nameMatchScore,
        matched: true,
        vendor: params.vendor,
      });
      if (moveToReview && inReview) {
        await tx.application.update({
          where: { id: params.applicationId },
          data: {
            applicationStatusId: inReview.id,
            applicationStatusNote: null,
            rejectionReasonId: null,
          },
        });
      }
      if (clearLeadNote) {
        await tx.lead.update({
          where: { id: params.leadId },
          data: { leadStatusNote: null },
        });
      }
    });

    return moveToReview ? APPLICATION_STATUS.IN_REVIEW : params.currentStatus;
  }

  private async persistNameMismatch(params: {
    applicationId: bigint;
    leadId: bigint;
    currentStatus: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    holderName: string;
    vendor: unknown;
    nameMatchScore: number | null;
    bankNameAtVendor: string | null;
  }): Promise<string> {
    const moveToReview = this.canMoveToInReview(params.currentStatus);
    const inReview = moveToReview ? await this.requireInReviewStatus() : null;
    this.logger.warn(
      `[penny-drop-recheck] Name mismatch application=${params.applicationId.toString()} score=${params.nameMatchScore ?? 'n/a'}`,
    );

    await this.prisma.client.$transaction(async (tx) => {
      await tx.applicationDetail.updateMany({
        where: { applicationId: params.applicationId },
        data: {
          bankAccountNumber: params.accountNumber,
          ifscCode: params.ifsc,
          bankName: params.bankName.length > 0 ? params.bankName : null,
          pennyDropVendorJson:
            params.vendor === null ? Prisma.JsonNull : (params.vendor as Prisma.InputJsonValue),
        },
      });
      await this.insertAttempt(tx, {
        applicationId: params.applicationId,
        accountNumber: params.accountNumber,
        ifsc: params.ifsc,
        bankName: params.bankName,
        accountHolderName: params.holderName,
        nameAtBank: params.bankNameAtVendor,
        nameMatchScore: params.nameMatchScore,
        matched: false,
        vendor: params.vendor,
      });
      await tx.application.update({
        where: { id: params.applicationId },
        data: {
          ...(moveToReview && inReview ? { applicationStatusId: inReview.id } : {}),
          applicationStatusNote: BANK_NAME_REVIEW_NOTE,
          rejectionReasonId: null,
        },
      });
      await tx.lead.update({
        where: { id: params.leadId },
        data: { leadStatusNote: null },
      });
    });

    return moveToReview ? APPLICATION_STATUS.IN_REVIEW : params.currentStatus;
  }

  private async recordAttempt(params: {
    applicationId: bigint;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    accountHolderName: string;
    nameAtBank: string | null;
    nameMatchScore: number | null;
    matched: boolean;
    vendor: unknown;
  }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await this.insertAttempt(tx, params);
    });
  }

  private async insertAttempt(
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

  private async requireInReviewStatus(): Promise<{ id: number }> {
    const inReview = await this.prisma.client.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.IN_REVIEW, isActive: true },
      select: { id: true },
    });
    if (!inReview) {
      throw new BadRequestException('Application status IN_REVIEW is not configured.');
    }
    return inReview;
  }

  private async loadNameMatchMinScore(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.PENNY_DROP_NAME_MATCH_MIN_SCORE.key, isActive: true },
      select: { value: true },
    });
    const n = row ? Number.parseInt(row.value.trim(), 10) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 100
      ? n
      : Number.parseInt(SettingKey.PENNY_DROP_NAME_MATCH_MIN_SCORE.default, 10);
  }
}
