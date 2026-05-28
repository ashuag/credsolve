import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_KYC_STATUS, APPLICATION_STATUS } from '../constants/application.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KycIdentityRejectionService {
  private readonly logger = new Logger(KycIdentityRejectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lead rejected + application marked KYC_FAILED when Aadhaar identity does not match profile.
   */
  async rejectForAadhaarProfileMismatch(params: {
    leadId: bigint;
    applicationId: bigint;
    note: string;
  }): Promise<void> {
    const [rejectedLeadStatus, kycFailedAppStatus, rejectionReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.KYC_FAILED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.rejectionReason.findFirst({
        where: { name: REJECTION_REASON.KYC_AADHAAR_MISMATCH, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!rejectedLeadStatus) {
      this.logger.warn('LeadStatus REJECTED not found — skipping KYC identity rejection.');
      return;
    }
    if (!kycFailedAppStatus) {
      this.logger.warn(
        `ApplicationStatus ${APPLICATION_STATUS.KYC_FAILED} not found — run seed; skipping application status update.`,
      );
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: params.leadId },
        data: {
          leadStatusId: rejectedLeadStatus.id,
          leadStatusNote: params.note.slice(0, 256),
          ...(rejectionReason ? { rejectionReasonId: rejectionReason.id } : {}),
        },
      });

      await tx.application.update({
        where: { id: params.applicationId },
        data: {
          kycStatus: APPLICATION_KYC_STATUS.FAILED,
          ...(kycFailedAppStatus ? { applicationStatusId: kycFailedAppStatus.id } : {}),
        },
      });
    });
  }
}
