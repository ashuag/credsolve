import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
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

    const application = await this.applications.ensureDraftApplicationForLead({
      leadId: lead.id,
      customerId: customer.id,
    });
    assertApplicationKycNotCompleted(application.kycStatus);

    const rel = this.kycFiles.selfieRelativePath(customer.uuid, application.uuid);
    await this.kycFiles.writeBytes(rel, file.buffer);
    await this.applications.updateSelfiePath({ applicationId: application.id, selfieRelativePath: rel });

    return { success: true, selfieRelativePath: rel };
  }
}
