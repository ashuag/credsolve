import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AADHAAR_KYC_TYPE } from '../../../../common/constants/aadhaar-kyc-process.constants';
import { AadhaarXmlOtpStore } from '../../../../common/kyc/aadhaar-xml-otp.store';
import { isAadhaarXmlDownloadValid } from '../../../../common/kyc/aadhaar-xml-otp.util';
import { isTenacioVendorBusinessSuccess } from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
import { KycDigilockerDownloadFailureService } from '../../../../common/kyc/kyc-digilocker-download-failure.service';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { AadhaarXmlOtpVendorService } from '../../../../common/vendor/aadhaar-xml-otp-vendor.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { DownloadAadhaarXmlDto } from '../dto/download-aadhaar-xml.dto';
import {
  DownloadAadhaarDigilockerUseCase,
  type DownloadAadhaarDigilockerResult,
} from './download-aadhaar-digilocker.use-case';

export type DownloadAadhaarXmlResult = DownloadAadhaarDigilockerResult & {
  referenceIdIssued?: boolean;
};

@Injectable()
export class DownloadAadhaarXmlUseCase {
  private readonly logger = new Logger(DownloadAadhaarXmlUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly vendor: AadhaarXmlOtpVendorService,
    private readonly otpStore: AadhaarXmlOtpStore,
    private readonly kycFailure: KycDigilockerDownloadFailureService,
    private readonly completeAadhaar: DownloadAadhaarDigilockerUseCase,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, dto: DownloadAadhaarXmlDto): Promise<DownloadAadhaarXmlResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) {
      throw new BadRequestException('No active loan application was found for your account.');
    }
    await assertActiveApplicationLoanDocumentsAccepted(this.prisma.client, {
      leadId: lead.id,
      customerId: customer.id,
    });

    const application = await this.applications.ensureDraftApplicationForLead({
      leadId: lead.id,
      customerId: customer.id,
    });
    const appKyc = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId: application.id },
      select: { kycStatus: true, aadhaarXmlOtpAttempts: true },
    });
    assertApplicationKycNotCompleted(appKyc?.kycStatus);

    const referenceId = await this.otpStore.read(application.uuid);
    if (!referenceId) {
      throw new BadRequestException('Request an Aadhaar OTP first, then enter the code you received.');
    }

    const maxAttempts = await this.kycFailure.readAadhaarXmlOtpMaxAttempts();
    const priorAttempts = appKyc?.aadhaarXmlOtpAttempts ?? 0;
    if (priorAttempts >= maxAttempts) {
      await this.kycFailure.markDigilockerFallbackEligible(application.id);
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: null,
        attemptsUsed: priorAttempts,
        attemptsAllowed: maxAttempts,
        canRetry: false,
        leadRejected: false,
        terminalFailure: false,
        digilockerFallback: true,
      };
    }

    const out = await this.vendor.postXmlDownload(
      { input: { referenceId, otp: dto.otp.trim() } },
      lead.id,
    );
    const vendor = out.vendorBody ?? null;
    if (!out.configured) {
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
      };
    }

    if (
      !out.ok ||
      !isTenacioVendorBusinessSuccess(vendor) ||
      !isAadhaarXmlDownloadValid(vendor)
    ) {
      const escalation = await this.kycFailure.recordXmlOtpFailureAndEscalate({
        leadId: lead.id,
        applicationId: application.id,
        customerMobile: customer.mobileNumber,
      });
      this.logger.warn(
        `Aadhaar XML download failed (leadId=${lead.id.toString()}, http=${out.httpStatus ?? 'n/a'}).`,
      );
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        businessSuccess: out.ok ? false : undefined,
        ...escalation,
      };
    }

    const completed = await this.completeAadhaar.completeFromVendorPayload({
      sessionToken: '',
      vendorKind: 'tenacio',
      leadId: lead.id,
      customerId: customer.id,
      customerUuid: customer.uuid,
      customerMobile: customer.mobileNumber,
      applicationId: application.id,
      applicationUuid: application.uuid,
      vendor,
      httpStatus: out.httpStatus,
      aadhaarKycType: AADHAAR_KYC_TYPE.OTP,
    });
    if (completed.ok) {
      await this.otpStore.clear(application.uuid);
    }
    return completed;
  }
}
