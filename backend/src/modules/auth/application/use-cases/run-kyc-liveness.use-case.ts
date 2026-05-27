import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { APPLICATION_KYC_STATUS } from '../../../../common/constants/application.constants';
import { extractProfileFromDigilockerFormJson } from '../../../../common/kyc/digilocker-form-profile.util';
import { LivenessVendorService } from '../../../../common/vendor/liveness-vendor.service';
import {
  isTenacioVendorBusinessSuccess,
  pickTenacioVendorErrorMessage,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import {
  isKycLivenessCheckPaused,
  isKycLivenessOutboundSkipped,
} from '../../../../common/kyc/kyc-liveness-env.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';

export type RunKycLivenessResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  livenessPassed: boolean;
  /** From Tenacio `error.message` when the vendor rejects the request (HTTP may still be 200 via proxy). */
  vendorErrorMessage?: string;
  /** When `application.kyc_status` was already completed (no vendor call). */
  alreadyCompleted?: boolean;
};

@Injectable()
export class RunKycLivenessUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly liveness: LivenessVendorService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request): Promise<RunKycLivenessResult> {
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

    const application = await fetchLatestApplicationKycSnapshot(this.prisma.client, {
      leadId: lead.id,
      customerId: customer.id,
    });

    if (!application) {
      throw new BadRequestException('No application found for this lead.');
    }

    if (application.kycStatus === APPLICATION_KYC_STATUS.COMPLETED) {
      return {
        configured: true,
        ok: true,
        httpStatus: 200,
        vendor: null,
        livenessPassed: true,
        alreadyCompleted: true,
      };
    }

    if (!application.selfieRelativePath?.trim()) {
      throw new BadRequestException('Upload a selfie before running liveness.');
    }

    if (isKycLivenessOutboundSkipped()) {
      const paused = isKycLivenessCheckPaused();
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: paused ? { paused: true } : { outboundSkipped: true },
        livenessPassed: false,
        vendorErrorMessage: paused
          ? 'Liveness checks are temporarily paused. Your saved selfie is still on file.'
          : 'Partner liveness verification is turned off. Your saved selfie is still on file.',
      };
    }

    const buf = await this.kycFiles.readBytes(application.selfieRelativePath.trim());
    const imageB64 = buf.toString('base64');

    const out = await this.liveness.postLivenessCheck(
      { input: { consent: true, image: imageB64 } },
      lead.id,
    );

    if (!out.configured) {
      const vendor = out.vendorBody ?? null;
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        livenessPassed: false,
        vendorErrorMessage: pickTenacioVendorErrorMessage(vendor) ?? out.skipReason,
      };
    }

    const vendor = out.vendorBody ?? null;
    const businessOk = out.ok && isTenacioVendorBusinessSuccess(vendor);
    const checkedAt = new Date();

    await this.applications.updateLivenessResult({
      applicationId: application.id,
      livenessVendorJson: (vendor ?? null) as Prisma.InputJsonValue,
      passed: businessOk,
      checkedAt,
    });

    if (businessOk) {
      await this.finalizeKycForApplication({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: (application.digilockerAadhaarFormJson ?? null) as Prisma.JsonValue,
        aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
        selfieRelativePath: application.selfieRelativePath.trim(),
        checkedAt,
      });
    }

    return {
      configured: true,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendor,
      livenessPassed: businessOk,
      vendorErrorMessage: businessOk ? undefined : pickTenacioVendorErrorMessage(vendor),
    };
  }

  private async finalizeKycForApplication(params: {
    applicationId: bigint;
    customerId: bigint;
    digilockerAadhaarFormJson: Prisma.JsonValue | null;
    aadhaarPhotoRelativePath: string | null;
    selfieRelativePath: string;
    checkedAt: Date;
  }): Promise<void> {
    const profile = extractProfileFromDigilockerFormJson(params.digilockerAadhaarFormJson);

    await this.prisma.client.$transaction(async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: params.applicationId },
        select: { kycStatus: true },
      });
      if (!app || app.kycStatus === APPLICATION_KYC_STATUS.COMPLETED) {
        return;
      }

      await tx.application.update({
        where: { id: params.applicationId },
        data: {
          kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
          kycCompletedAt: params.checkedAt,
        },
      });

      let customerKyc = await tx.customerKyc.findFirst({
        where: { customerId: params.customerId },
        orderBy: { createdAt: 'desc' },
      });
      if (!customerKyc) {
        customerKyc = await tx.customerKyc.create({
          data: { customerId: params.customerId },
        });
      }

      await tx.customerKyc.update({
        where: { id: customerKyc.id },
        data: {
          kycVerifiedAt: params.checkedAt,
          ...(profile.fullName ? { fullName: profile.fullName.slice(0, 100) } : {}),
          ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
        },
      });

      const digilockerProvider = await tx.kycProvider.upsert({
        where: { name: 'DIGILOCKER' },
        create: { name: 'DIGILOCKER', displayName: 'DigiLocker', isActive: true },
        update: { displayName: 'DigiLocker', isActive: true },
      });

      const aadhaarFrontType = await tx.kycDocument.upsert({
        where: { name: 'AADHAAR_FRONT' },
        create: { name: 'AADHAAR_FRONT', displayName: 'Aadhaar (front)', isActive: true },
        update: { displayName: 'Aadhaar (front)', isActive: true },
      });

      await tx.customerKycDocument.deleteMany({
        where: {
          customerKycId: customerKyc.id,
          documentTypeId: aadhaarFrontType.id,
          kycProviderId: digilockerProvider.id,
        },
      });

      const auditName = [params.aadhaarPhotoRelativePath, params.selfieRelativePath]
        .filter(Boolean)
        .join('|')
        .slice(0, 255);

      await tx.customerKycDocument.create({
        data: {
          customerKycId: customerKyc.id,
          documentTypeId: aadhaarFrontType.id,
          kycProviderId: digilockerProvider.id,
          fileName: auditName.length > 0 ? auditName : 'digilocker+liveness',
          verifiedAt: params.checkedAt,
        },
      });
    });
  }
}
