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
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { SubmitVerifiedBankDto } from '../dto/submit-verified-bank.dto';

export type SubmitVerifiedBankResult = {
  success: boolean;
  pennyDropOk: boolean;
  applicationStatus: string | null;
  message?: string;
  vendor: unknown | null;
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
    const ifsc = dto.ifscCode.trim().toUpperCase();
    const verifiedBankName = dto.verifiedBankName?.trim() ?? '';

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
      };
    }

    const vendor = pennyOut.vendorBody ?? null;
    const pennyOk = pennyOut.ok && isTenacioVendorBusinessSuccess(vendor);

    if (!pennyOk) {
      return {
        success: false,
        pennyDropOk: false,
        applicationStatus: null,
        message:
          pickTenacioVendorErrorMessage(vendor) ??
          `Bank verification failed (HTTP ${pennyOut.httpStatus ?? 'n/a'}).`,
        vendor,
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
        throw new BadRequestException('Create application details before bank details.');
      }

      const details = await tx.applicationDetail.findUnique({
        where: { applicationId: application.id },
        select: { loanAmount: true },
      });
      const disbursementAmount = details?.loanAmount ?? null;

      await tx.applicationDisbursement.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          amount: disbursementAmount ? new Prisma.Decimal(disbursementAmount.toString()) : null,
          accountNumber,
          ifscCode: ifsc,
          disbursedAt: null,
        },
        update: {
          amount: disbursementAmount ? new Prisma.Decimal(disbursementAmount.toString()) : null,
          accountNumber,
          ifscCode: ifsc,
        },
      });

      const bankNameToStore = verifiedBankName.length > 0 ? verifiedBankName : null;
      await tx.$executeRaw`
        UPDATE application_disbursement
        SET bank_name = ${bankNameToStore}
        WHERE application_id = ${application.id}
      `;

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
    };
  }
}
