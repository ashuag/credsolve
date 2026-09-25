import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_KYC_STATUS, APPLICATION_STATUS } from '../constants/application.constants';
import {
  AADHAAR_XML_OTP_MAX_ATTEMPTS,
  DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS,
} from '../constants/kyc.constants';
import { SettingKey } from '../constants/setting.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../../prisma/prisma.service';

const AADHAAR_DIGILOCKER_FAILED_NOTE = 'Aadhaar DigiLocker KYC failed';

export type DigilockerDownloadFailureEscalation = {
  attemptsUsed: number;
  attemptsAllowed: number;
  canRetry: boolean;
  leadRejected: boolean;
  terminalFailure: boolean;
};

export type AadhaarXmlOtpFailureEscalation = {
  attemptsUsed: number;
  attemptsAllowed: number;
  canRetry: boolean;
  leadRejected: boolean;
  terminalFailure: boolean;
  digilockerFallback: boolean;
};

@Injectable()
export class KycDigilockerDownloadFailureService {
  private readonly logger = new Logger(KycDigilockerDownloadFailureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async readAadhaarXmlOtpMaxAttempts(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.AADHAAR_XML_OTP_MAX_ATTEMPTS.key, isActive: true },
      select: { value: true },
    });
    const n = row ? Number.parseInt(row.value.trim(), 10) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    const fallback = Number.parseInt(SettingKey.AADHAAR_XML_OTP_MAX_ATTEMPTS.default, 10);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : AADHAAR_XML_OTP_MAX_ATTEMPTS;
  }

  async readAttemptsUsed(applicationId: bigint): Promise<number> {
    const row = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId },
      select: { digilockerAadhaarDownloadAttempts: true },
    });
    return row?.digilockerAadhaarDownloadAttempts ?? 0;
  }

  async readXmlOtpAttemptsUsed(applicationId: bigint): Promise<number> {
    const row = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId },
      select: { aadhaarXmlOtpAttempts: true },
    });
    return row?.aadhaarXmlOtpAttempts ?? 0;
  }

  async isDigilockerFallbackEligible(applicationId: bigint): Promise<boolean> {
    const row = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId },
      select: { digilockerFallbackEligible: true },
    });
    return Boolean(row?.digilockerFallbackEligible);
  }

  async markDigilockerFallbackEligible(applicationId: bigint): Promise<void> {
    await this.prisma.client.applicationKyc.upsert({
      where: { applicationId },
      create: {
        applicationId,
        digilockerFallbackEligible: true,
      },
      update: { digilockerFallbackEligible: true },
    });
  }

  async clearAadhaarKycAttempts(applicationId: bigint): Promise<void> {
    await this.prisma.client.applicationKyc.upsert({
      where: { applicationId },
      create: {
        applicationId,
        aadhaarXmlOtpAttempts: 0,
        digilockerAadhaarDownloadAttempts: 0,
        digilockerFallbackEligible: false,
      },
      update: {
        aadhaarXmlOtpAttempts: 0,
        digilockerAadhaarDownloadAttempts: 0,
        digilockerFallbackEligible: false,
      },
    });
  }

  async recordFailureAndEscalate(params: {
    leadId: bigint;
    applicationId: bigint;
    customerMobile?: string;
  }): Promise<DigilockerDownloadFailureEscalation> {
    const max = DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS;
    const attemptsUsed = (await this.readAttemptsUsed(params.applicationId)) + 1;

    await this.prisma.client.applicationKyc.upsert({
      where: { applicationId: params.applicationId },
      create: {
        applicationId: params.applicationId,
        digilockerAadhaarDownloadAttempts: attemptsUsed,
      },
      update: {
        digilockerAadhaarDownloadAttempts: attemptsUsed,
      },
    });

    const terminalFailure = attemptsUsed >= max;
    if (terminalFailure) {
      await this.rejectForKycVerificationFailed(params, AADHAAR_DIGILOCKER_FAILED_NOTE);
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

  async recordXmlOtpFailureAndEscalate(params: {
    leadId: bigint;
    applicationId: bigint;
    customerMobile?: string;
  }): Promise<AadhaarXmlOtpFailureEscalation> {
    const max = await this.readAadhaarXmlOtpMaxAttempts();
    const attemptsUsed = (await this.readXmlOtpAttemptsUsed(params.applicationId)) + 1;
    const unlockDigilocker = attemptsUsed >= max;

    await this.prisma.client.applicationKyc.upsert({
      where: { applicationId: params.applicationId },
      create: {
        applicationId: params.applicationId,
        aadhaarXmlOtpAttempts: attemptsUsed,
        digilockerFallbackEligible: unlockDigilocker,
      },
      update: {
        aadhaarXmlOtpAttempts: attemptsUsed,
        ...(unlockDigilocker ? { digilockerFallbackEligible: true } : {}),
      },
    });

    if (unlockDigilocker) {
      this.logger.log(
        `Lead ${params.leadId.toString()} Aadhaar XML OTP exhausted (attempt ${attemptsUsed}/${max}) — DigiLocker fallback available.`,
      );
    } else {
      this.logger.log(
        `Lead ${params.leadId.toString()} Aadhaar XML OTP failed (attempt ${attemptsUsed}/${max}) — retry allowed.`,
      );
    }

    return {
      attemptsUsed,
      attemptsAllowed: max,
      canRetry: !unlockDigilocker,
      leadRejected: false,
      terminalFailure: false,
      digilockerFallback: unlockDigilocker,
    };
  }

  private async rejectForKycVerificationFailed(
    params: {
      leadId: bigint;
      applicationId: bigint;
      customerMobile?: string;
    },
    statusNote: string,
  ): Promise<void> {
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
      this.logger.warn('LeadStatus REJECTED not found — skipping Aadhaar KYC rejection.');
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
          leadStatusNote: statusNote,
          ...(rejectionReason ? { rejectionReasonId: rejectionReason.id } : {}),
        },
      });

      await tx.applicationKyc.upsert({
        where: { applicationId: params.applicationId },
        create: {
          applicationId: params.applicationId,
          kycStatus: APPLICATION_KYC_STATUS.FAILED,
        },
        update: { kycStatus: APPLICATION_KYC_STATUS.FAILED },
      });
      await tx.application.update({
        where: { id: params.applicationId },
        data: {
          ...(kycFailedAppStatus ? { applicationStatusId: kycFailedAppStatus.id } : {}),
          ...(rejectionReason ? { rejectionReasonId: rejectionReason.id } : {}),
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
