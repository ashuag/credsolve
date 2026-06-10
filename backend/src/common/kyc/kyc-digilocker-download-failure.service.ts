import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_KYC_STATUS, APPLICATION_STATUS } from '../constants/application.constants';
import { DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS } from '../constants/kyc.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../../prisma/prisma.service';

const DIGILOCKER_DOWNLOAD_FAILED_NOTE = 'DigiLocker Aadhaar download failed';

export type DigilockerDownloadFailureEscalation = {
  attemptsUsed: number;
  attemptsAllowed: number;
  canRetry: boolean;
  leadRejected: boolean;
  terminalFailure: boolean;
};

@Injectable()
export class KycDigilockerDownloadFailureService {
  private readonly logger = new Logger(KycDigilockerDownloadFailureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async readAttemptsUsed(leadId: bigint): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<Array<{ digilocker_aadhaar_download_attempts: number }>>`
      SELECT \`digilocker_aadhaar_download_attempts\` FROM \`lead\` WHERE \`id\` = ${leadId} LIMIT 1
    `;
    return Number(rows[0]?.digilocker_aadhaar_download_attempts ?? 0);
  }

  async recordFailureAndEscalate(params: {
    leadId: bigint;
    applicationId: bigint;
    customerMobile?: string;
  }): Promise<DigilockerDownloadFailureEscalation> {
    const max = DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS;
    const attemptsUsed = (await this.readAttemptsUsed(params.leadId)) + 1;

    await this.prisma.client.$executeRaw`
      UPDATE \`lead\` SET \`digilocker_aadhaar_download_attempts\` = ${attemptsUsed} WHERE \`id\` = ${params.leadId}
    `;

    const terminalFailure = attemptsUsed >= max;
    if (terminalFailure) {
      await this.rejectForKycVerificationFailed(params);
      this.logger.warn(
        `Lead ${params.leadId.toString()} rejected after ${attemptsUsed} DigiLocker Aadhaar download failures.`,
      );
    } else {
      this.logger.log(
        `Lead ${params.leadId.toString()} DigiLocker download failed (attempt ${attemptsUsed}/${max}) — retry allowed.`,
      );
    }

    return {
      attemptsUsed,
      attemptsAllowed: max,
      canRetry: !terminalFailure,
      leadRejected: terminalFailure,
      terminalFailure,
    };
  }

  private async rejectForKycVerificationFailed(params: {
    leadId: bigint;
    applicationId: bigint;
    customerMobile?: string;
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
        where: { name: REJECTION_REASON.KYC_VERIFICATION_FAILED, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!rejectedLeadStatus) {
      this.logger.warn('LeadStatus REJECTED not found — skipping DigiLocker download rejection.');
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
          leadStatusNote: DIGILOCKER_DOWNLOAD_FAILED_NOTE,
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

    const mobile = params.customerMobile?.trim();
    if (mobile) {
      void this.sms.sendRejectionSms(mobile, params.leadId).catch((err) => {
        this.logger.error('Failed to send rejection SMS', err instanceof Error ? err.stack : err);
      });
    }
  }
}
