import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { DigilockerVendorService } from '../../../../common/vendor/digilocker-vendor.service';
import {
  buildDigilockerAadhaarFormJson,
  decodeAadhaarPhoto,
  extractAadhaarPhotoString,
  isTenacioVendorBusinessSuccess,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
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
};

@Injectable()
export class DownloadAadhaarDigilockerUseCase {
  private readonly logger = new Logger(DownloadAadhaarDigilockerUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly digilocker: DigilockerVendorService,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
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
    assertApplicationKycNotCompleted(applicationRow.kycStatus);

    const consent = dto.consent !== false;
    const out = await this.digilocker.postAadhaarDownload(
      { input: { sessionToken: dto.sessionToken.trim(), consent } },
      lead.id,
    );

    if (!out.configured) {
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: false,
        httpStatus: out.httpStatus,
        vendor: out.vendorBody ?? null,
      };
    }

    if (!out.ok) {
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor: out.vendorBody ?? null,
      };
    }

    const vendor = out.vendorBody ?? null;
    const businessSuccess = isTenacioVendorBusinessSuccess(vendor);
    if (!businessSuccess) {
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        businessSuccess: false,
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
        digilockerAadhaarFormJson: formJson as Prisma.InputJsonValue,
        aadhaarPhotoRelativePath: photoRel,
      });
      persisted = true;
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
      businessSuccess: true,
      persisted,
    };
  }
}
