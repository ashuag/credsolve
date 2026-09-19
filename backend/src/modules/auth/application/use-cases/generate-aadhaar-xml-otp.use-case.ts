import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AadhaarXmlOtpStore } from '../../../../common/kyc/aadhaar-xml-otp.store';
import {
  extractAadhaarXmlReferenceId,
  isValidAadhaarNumber,
  normalizeAadhaarNumber,
} from '../../../../common/kyc/aadhaar-xml-otp.util';
import {
  isDigilockerAadhaarCaptureComplete,
  isTenacioVendorBusinessSuccess,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { KycDigilockerDownloadFailureService } from '../../../../common/kyc/kyc-digilocker-download-failure.service';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { AadhaarXmlOtpVendorService } from '../../../../common/vendor/aadhaar-xml-otp-vendor.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { GenerateAadhaarXmlOtpDto } from '../dto/generate-aadhaar-xml-otp.dto';

export type GenerateAadhaarXmlOtpResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  referenceIdIssued?: boolean;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  canRetry?: boolean;
  leadRejected?: boolean;
  terminalFailure?: boolean;
  digilockerFallback?: boolean;
  alreadyCaptured?: boolean;
};

@Injectable()
export class GenerateAadhaarXmlOtpUseCase {
  private readonly logger = new Logger(GenerateAadhaarXmlOtpUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly vendor: AadhaarXmlOtpVendorService,
    private readonly otpStore: AadhaarXmlOtpStore,
    private readonly kycFailure: KycDigilockerDownloadFailureService,
    private readonly prisma: PrismaService,
    private readonly kycCompletion: KycCompletionService,
  ) {}

  async execute(req: Request, dto: GenerateAadhaarXmlOtpDto): Promise<GenerateAadhaarXmlOtpResult> {
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

    const linked = await this.kycCompletion.linkReusableAadhaarToApplication({
      applicationId: application.id,
      customerId: customer.id,
      mobileNumber: customer.mobileNumber,
      leadFullName: lead.leadDetail?.fullName ?? null,
      leadDateOfBirth: lead.leadDetail?.dateOfBirth ?? null,
      leadGender: lead.leadDetail?.gender?.key ?? lead.leadDetail?.gender?.name ?? null,
    });
    if (
      linked.complete ||
      isDigilockerAadhaarCaptureComplete(
        (application as { digilockerAadhaarFormJson?: unknown }).digilockerAadhaarFormJson,
      )
    ) {
      return {
        configured: true,
        ok: true,
        httpStatus: null,
        vendor: null,
        alreadyCaptured: true,
      };
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

    const aadhaarNumber = normalizeAadhaarNumber(dto.aadhaarNumber);
    if (!isValidAadhaarNumber(aadhaarNumber) || dto.consent !== true) {
      throw new BadRequestException('Enter a valid 12-digit Aadhaar number and accept consent.');
    }

    await this.prisma.client.applicationDetail.upsert({
      where: { applicationId: application.id },
      create: { applicationId: application.id, aadhaarNumber },
      update: { aadhaarNumber },
    });

    const out = await this.vendor.postGenerateOtp(
      { input: { aadhaarNumber, consent: true } },
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

    const referenceId = extractAadhaarXmlReferenceId(vendor);
    if (!out.ok || !isTenacioVendorBusinessSuccess(vendor) || !referenceId) {
      const escalation = await this.kycFailure.recordXmlOtpFailureAndEscalate({
        leadId: lead.id,
        applicationId: application.id,
        customerMobile: customer.mobileNumber,
      });
      this.logger.warn(
        `Aadhaar XML generate-otp failed (leadId=${lead.id.toString()}, http=${out.httpStatus ?? 'n/a'}).`,
      );
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        referenceIdIssued: false,
        ...escalation,
      };
    }

    await this.otpStore.save(application.uuid, referenceId);
    return {
      configured: true,
      ok: true,
      httpStatus: out.httpStatus,
      vendor: null,
      referenceIdIssued: true,
    };
  }
}
