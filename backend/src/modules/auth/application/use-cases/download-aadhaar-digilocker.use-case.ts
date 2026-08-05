import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { DigilockerSessionStore } from '../../../../common/kyc/digilocker-session.store';
import { DigilockerVendorService } from '../../../../common/vendor/digilocker-vendor.service';
import {
  buildDigilockerAadhaarFormJson,
  buildDigilockerVendorAttemptJson,
  decodeAadhaarPhoto,
  extractAadhaarPhotoString,
  isDigilockerAadhaarCaptureComplete,
  isTenacioVendorBusinessSuccess,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { compareAadhaarToLeadProfile } from '../../../../common/kyc/aadhaar-lead-identity-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS } from '../../../../common/constants/kyc.constants';
import { KycDigilockerDownloadFailureService } from '../../../../common/kyc/kyc-digilocker-download-failure.service';
import { KycIdentityRejectionService } from '../../../../common/kyc/kyc-identity-rejection.service';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import type { DownloadAadhaarDigilockerDto } from '../dto/download-aadhaar-digilocker.dto';

export type DownloadAadhaarDigilockerResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  /** When HTTP succeeded but Tenacio `status` was not `success`. */
  businessSuccess?: boolean;
  /** When Aadhaar JSON + optional photo were written to DB / disk. */
  persisted?: boolean;
  /** Name or DOB on Aadhaar did not match lead profile — application set to KYC_FAILED. */
  identityMismatch?: boolean;
  identityMismatchMessage?: string;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  canRetry?: boolean;
  leadRejected?: boolean;
  terminalFailure?: boolean;
};

@Injectable()
export class DownloadAadhaarDigilockerUseCase {
  private readonly logger = new Logger(DownloadAadhaarDigilockerUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly digilocker: DigilockerVendorService,
    private readonly digilockerSession: DigilockerSessionStore,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly kycIdentityRejection: KycIdentityRejectionService,
    private readonly kycDigilockerDownloadFailure: KycDigilockerDownloadFailureService,
    private readonly kycCompletion: KycCompletionService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, dto: DownloadAadhaarDigilockerDto): Promise<DownloadAadhaarDigilockerResult> {
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

    const applicationRow = await this.applications.ensureDraftApplicationForLead({
      leadId: lead.id,
      customerId: customer.id,
    });
    const appKyc = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId: applicationRow.id },
      select: { kycStatus: true },
    });
    assertApplicationKycNotCompleted(appKyc?.kycStatus);

    const priorAttempts = await this.kycDigilockerDownloadFailure.readAttemptsUsed(applicationRow.id);
    if (priorAttempts >= DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS) {
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: null,
        attemptsUsed: priorAttempts,
        attemptsAllowed: DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS,
        canRetry: false,
        leadRejected: true,
        terminalFailure: true,
      };
    }

    let sessionToken = dto.sessionToken?.trim() ?? '';
    if (!sessionToken) {
      sessionToken = (await this.digilockerSession.read(applicationRow.uuid)) ?? '';
    }
    if (!sessionToken) {
      throw new BadRequestException(
        'Missing DigiLocker session token. Start DigiLocker again from KYC (Login with DigiLocker), then return to this page.',
      );
    }

    const consent = dto.consent !== false;
    const out = await this.digilocker.postAadhaarDownload(
      { input: { sessionToken, consent } },
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

    if (!out.ok || !isTenacioVendorBusinessSuccess(vendor)) {
      await this.persistVendorAttempt(applicationRow, out.httpStatus, vendor);
      const escalation = await this.kycDigilockerDownloadFailure.recordFailureAndEscalate({
        leadId: lead.id,
        applicationId: applicationRow.id,
        customerMobile: customer.mobileNumber,
      });
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        businessSuccess: out.ok ? false : undefined,
        ...escalation,
      };
    }

    const businessSuccess = true;

    const leadProfile = await this.prisma.client.leadDetail.findUnique({
      where: { leadId: lead.id },
      select: { fullName: true, dateOfBirth: true },
    });

    const identityMatch = compareAadhaarToLeadProfile({
      leadFullName: leadProfile?.fullName ?? null,
      leadDateOfBirth: leadProfile?.dateOfBirth ?? null,
      vendor,
    });

    if (!identityMatch.matched) {
      await this.kycIdentityRejection.rejectForAadhaarProfileMismatch({
        leadId: lead.id,
        applicationId: applicationRow.id,
        customerMobile: customer.mobileNumber,
      });
      await this.digilockerSession.clear(applicationRow.uuid);
      this.logger.warn(
        `Aadhaar identity mismatch (leadId=${lead.id.toString()}, reason=${identityMatch.reason}): ${identityMatch.message}`,
      );
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        businessSuccess: true,
        identityMismatch: true,
        identityMismatchMessage: identityMatch.message,
      };
    }

    let persisted = false;
    try {
      const application = applicationRow;

      const photoRaw = extractAadhaarPhotoString(vendor);
      let photoRel: string | null = null;
      if (photoRaw) {
        const decoded = decodeAadhaarPhoto(photoRaw);
        if (decoded?.buffer.length) {
          photoRel = this.kycFiles.aadhaarPhotoRelativePath(
            customer.uuid,
            application.uuid,
            decoded.ext,
          );
          await this.kycFiles.writeBytes(photoRel, decoded.buffer);
        }
      }

      const formJson = buildDigilockerAadhaarFormJson(vendor, photoRel) ?? { _note: 'digilocker_vendor_unparsed' };
      await this.applications.updateDigilockerAadhaarArtifacts({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: formJson as Prisma.InputJsonValue,
        aadhaarPhotoRelativePath: photoRel,
      });
      persisted = true;
      await this.digilockerSession.clear(application.uuid);
      // Selfie/liveness removed pending rewrite — DigiLocker Aadhaar completes KYC.
      await this.kycCompletion.completeFromDigilockerAadhaar({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: formJson as Prisma.JsonValue,
        aadhaarPhotoRelativePath: photoRel,
        verifiedAt: new Date(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist DigiLocker Aadhaar artifacts: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    return {
      configured: true,
      ok: true,
      httpStatus: out.httpStatus,
      vendor,
      businessSuccess,
      persisted,
    };
  }

  private async persistVendorAttempt(
    application: { id: bigint; customerId: bigint },
    httpStatus: number | null,
    vendor: unknown,
  ): Promise<void> {
    const customerKyc = await this.prisma.client.customerKyc.findFirst({
      where: { customerId: application.customerId },
      orderBy: { createdAt: 'desc' },
      select: { aadhaarData: true },
    });
    if (isDigilockerAadhaarCaptureComplete(customerKyc?.aadhaarData)) {
      return;
    }
    try {
      await this.applications.updateDigilockerAadhaarArtifacts({
        applicationId: application.id,
        customerId: application.customerId,
        digilockerAadhaarFormJson: buildDigilockerVendorAttemptJson({
          httpStatus,
          vendor,
        }) as Prisma.InputJsonValue,
        aadhaarPhotoRelativePath: null,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist DigiLocker vendor attempt (applicationId=${application.id.toString()}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
