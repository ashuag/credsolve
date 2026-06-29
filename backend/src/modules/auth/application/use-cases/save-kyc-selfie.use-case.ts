import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import {
  buildKycPipelineStepLog,
  formatKycPipelineStepForLogger,
} from '../../../../common/kyc/kyc-liveness-pipeline-log.util';
import {
  assertApplicationFaceStepNotComplete,
} from '../../../../common/kyc/application-kyc-guard.util';
import { APPLICATION_KYC_STATUS } from '../../../../common/constants/application.constants';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';

const MAX_SELFIE_BYTES = 6 * 1024 * 1024;

@Injectable()
export class SaveKycSelfieUseCase {
  private readonly logger = new Logger(SaveKycSelfieUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    req: Request,
    file: UploadedFileLike | undefined,
  ): Promise<{
    success: true;
    selfieRelativePath: string;
  }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please capture or choose a selfie image.');
    }
    if (file.size > MAX_SELFIE_BYTES) {
      throw new BadRequestException('Selfie must be 6MB or smaller.');
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    if (!mime.includes('jpeg') && !mime.includes('jpg')) {
      throw new BadRequestException('Selfie must be a JPEG image.');
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

    const [appKyc, customerKyc] = await Promise.all([
      this.prisma.client.applicationKyc.findUnique({
        where: { applicationId: application.id },
      }),
      this.prisma.client.customerKyc.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        select: { aadhaarData: true },
      }),
    ]);

    assertApplicationFaceStepNotComplete({
      kycStatus: appKyc?.kycStatus,
      selfieRelativePath: appKyc?.livenessSelfiePath,
      livenessPassed: appKyc?.livenessPassed,
      digilockerAadhaarFormJson: customerKyc?.aadhaarData,
    });

    // Recover applications marked COMPLETED after Aadhaar-only (before selfie was required).
    if (
      appKyc?.kycStatus === APPLICATION_KYC_STATUS.COMPLETED &&
      !appKyc.livenessSelfiePath?.trim()
    ) {
      await this.prisma.client.applicationKyc.update({
        where: { applicationId: application.id },
        data: {
          kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: null,
        },
      });
    }

    const rel = this.kycFiles.selfieRelativePath(customer.uuid, application.uuid);
    await this.kycFiles.writeBytes(rel, file.buffer);
    await this.applications.updateSelfiePath({ applicationId: application.id, selfieRelativePath: rel });

    this.logger.log(
      formatKycPipelineStepForLogger(
        buildKycPipelineStepLog('1-selfie-upload', {
          ok: true,
          request: {
            applicationId: application.id.toString(),
            leadId: lead.id.toString(),
            bytes: file.buffer.length,
            mime: file.mimetype ?? null,
          },
          response: { success: true, selfieRelativePath: rel },
        }),
      ),
    );

    return {
      success: true,
      selfieRelativePath: rel,
    };
  }
}
