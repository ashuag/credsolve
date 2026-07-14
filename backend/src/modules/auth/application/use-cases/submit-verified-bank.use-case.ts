import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { SmsService } from '../../../../common/sms/sms.service';
import { BankTenacioVendorService } from '../../../../common/vendor/bank-tenacio-vendor.service';
import {
  isTenacioVendorBusinessSuccess,
  pickTenacioVendorErrorMessage,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { compareJourneyNameToPennyDrop } from '../../../../common/kyc/penny-drop-name-match.util';
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
    const applicationRow = await this.prisma.client.application.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, details: { select: { pennyDropAttempts: true } } },
    });
    if (!applicationRow) {
      throw new BadRequestException('Create application details before bank details.');
    }

    const attemptsUsed = applicationRow.details?.pennyDropAttempts ?? 0;
    if (attemptsUsed >= attemptsAllowed) {
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus: null,
        message:
          'You have reached the maximum number of bank verification attempts. Please contact support to continue.',
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
      await this.prisma.client.applicationDetail.update({
        where: { applicationId: applicationRow.id },
        data: {
          pennyDropAttempts: nextAttemptsUsed,
          pennyDropVendorJson:
            vendor === null ? Prisma.JsonNull : (vendor as Prisma.InputJsonValue),
        },
      });
      const retryLimitReached = nextAttemptsUsed >= attemptsAllowed;
      const baseMessage =
        pickTenacioVendorErrorMessage(vendor) ??
        `Bank verification failed (HTTP ${pennyOut.httpStatus ?? 'n/a'}).`;
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus: null,
        message: retryLimitReached
          ? `${baseMessage} You have reached the maximum number of verification attempts. Please contact support.`
          : baseMessage,
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
    if (!nameMatch.matched) {
      const nextAttemptsUsed = attemptsUsed + 1;
      await this.prisma.client.applicationDetail.update({
        where: { applicationId: applicationRow.id },
        data: {
          pennyDropAttempts: nextAttemptsUsed,
          pennyDropVendorJson:
            vendor === null ? Prisma.JsonNull : (vendor as Prisma.InputJsonValue),
        },
      });
      const retryLimitReached = nextAttemptsUsed >= attemptsAllowed;
      this.logger.warn(
        `[penny-drop] Name mismatch lead=${lead.id.toString()} reason=${nameMatch.reason} ` +
          `bankName=${nameMatch.bankName ? '[present]' : '[missing]'}`,
      );
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus: null,
        message: retryLimitReached
          ? `${nameMatch.message} You have reached the maximum number of verification attempts. Please contact support.`
          : nameMatch.message,
        vendor,
        attemptsUsed: nextAttemptsUsed,
        attemptsAllowed,
        retryLimitReached,
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
    };
  }
}
