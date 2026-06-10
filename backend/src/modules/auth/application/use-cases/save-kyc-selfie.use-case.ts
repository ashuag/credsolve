import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { isKycLivenessOutboundSkipped } from '../../../../common/kyc/kyc-liveness-env.util';
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
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly kycCompletion: KycCompletionService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, file: UploadedFileLike | undefined): Promise<{ success: true; selfieRelativePath: string }> {
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
    assertApplicationFaceStepNotComplete({
      kycStatus: application.kycStatus,
      selfieRelativePath: application.selfieRelativePath,
      livenessPassed: application.livenessPassed,
      digilockerAadhaarFormJson: application.digilockerAadhaarFormJson,
    });

    // Recover applications marked COMPLETED after Aadhaar-only (before selfie was required).
    if (
      application.kycStatus === APPLICATION_KYC_STATUS.COMPLETED &&
      !application.selfieRelativePath?.trim()
    ) {
      await this.prisma.client.application.update({
        where: { id: application.id },
        data: {
          kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: null,
        },
      });
    }

    const rel = this.kycFiles.selfieRelativePath(customer.uuid, application.uuid);
    await this.kycFiles.writeBytes(rel, file.buffer);
    await this.applications.updateSelfiePath({ applicationId: application.id, selfieRelativePath: rel });

    if (isKycLivenessOutboundSkipped()) {
      const snapshot = await this.prisma.client.application.findUnique({
        where: { id: application.id },
        select: {
          digilockerAadhaarFormJson: true,
          aadhaarPhotoRelativePath: true,
        },
      });
      await this.kycCompletion.completeFromDigilockerAadhaar({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: snapshot?.digilockerAadhaarFormJson ?? null,
        aadhaarPhotoRelativePath: snapshot?.aadhaarPhotoRelativePath ?? null,
        selfieRelativePath: rel,
        verifiedAt: new Date(),
      });
    }

    return { success: true, selfieRelativePath: rel };
  }
}
