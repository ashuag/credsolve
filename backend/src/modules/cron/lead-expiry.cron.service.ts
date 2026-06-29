import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { APPLICATION_STATUS } from '../../common/constants/application.constants';
import { LEAD_STATUS } from '../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../common/constants/rejection-reason.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsRepository } from '../auth/infrastructure/repositories/settings.repository';

const OPEN_LEAD_STATUSES = [
  LEAD_STATUS.NEW,
  LEAD_STATUS.IN_PROGRESS,
  LEAD_STATUS.INTERNAL_ERROR,
] as const;

const NON_EXPIRABLE_LEAD_STATUSES = [
  LEAD_STATUS.REJECTED,
  LEAD_STATUS.BLACKLISTED,
] as const;

const APPLICATION_SKIP_EXPIRY_STATUSES = [
  APPLICATION_STATUS.DISBURSED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.CANCELLED,
] as const;

const APPLICATION_SKIP_EXPIRY_STATUS_SET = new Set<string>(APPLICATION_SKIP_EXPIRY_STATUSES);

function isLeadExpiryCronEnabled(): boolean {
  const raw = process.env.LEAD_EXPIRY_CRON_ENABLED?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

function buildExpiryNote(leadExpireDays: number): string {
  return `Expired after ${leadExpireDays} day(s) without completing the journey.`.slice(0, 256);
}

@Injectable()
export class LeadExpiryCronService implements OnModuleInit {
  private readonly logger = new Logger(LeadExpiryCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsRepository,
  ) {}

  onModuleInit(): void {
    if (!isLeadExpiryCronEnabled()) {
      this.logger.warn('In-app lead expiry cron is disabled (LEAD_EXPIRY_CRON_ENABLED=false).');
      return;
    }
    this.logger.log('In-app lead expiry cron registered (daily at 00:00 UTC).');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyLeadExpiry(): Promise<void> {
    if (!isLeadExpiryCronEnabled()) {
      return;
    }
    await this.expireStaleLeads();
  }

  /**
   * When lead age (`created_at`) is >= `LEAD_EXPIRE_DAYS`:
   * - Non-converted leads → REJECTED with rejection reason EXPIRED.
   * - Converted leads with no disbursed application → application REJECTED with reason EXPIRED.
   */
  async expireStaleLeads(): Promise<number> {
    const leadExpireDays = await this.settings.loadLeadExpireDays();
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - leadExpireDays);
    const note = buildExpiryNote(leadExpireDays);

    const [rejectedLeadStatus, rejectedAppStatus, expiredReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.rejectionReason.findFirst({
        where: { name: REJECTION_REASON.EXPIRED, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!rejectedLeadStatus) {
      this.logger.error('Lead status REJECTED is missing — skip expiry pass.');
      return 0;
    }
    if (!expiredReason) {
      this.logger.error(`Rejection reason ${REJECTION_REASON.EXPIRED} is missing — skip expiry pass.`);
      return 0;
    }

    const openLeadCount = await this.rejectExpiredOpenLeads({
      cutoff,
      now,
      note,
      rejectedLeadStatusId: rejectedLeadStatus.id,
      expiredReasonId: expiredReason.id,
      leadExpireDays,
    });

    const convertedCount = await this.rejectExpiredConvertedApplications({
      cutoff,
      now,
      note,
      rejectedAppStatusId: rejectedAppStatus?.id ?? null,
      expiredReasonId: expiredReason.id,
      leadExpireDays,
    });

    return openLeadCount + convertedCount;
  }

  private async rejectExpiredOpenLeads(params: {
    cutoff: Date;
    now: Date;
    note: string;
    rejectedLeadStatusId: number;
    expiredReasonId: number;
    leadExpireDays: number;
  }): Promise<number> {
    const result = await this.prisma.client.lead.updateMany({
      where: {
        expiredAt: null,
        isActive: true,
        createdAt: { lte: params.cutoff },
        leadStatus: { name: { in: [...OPEN_LEAD_STATUSES] } },
        NOT: {
          leadStatus: { name: { in: [...NON_EXPIRABLE_LEAD_STATUSES] } },
        },
      },
      data: {
        expiredAt: params.now,
        leadStatusId: params.rejectedLeadStatusId,
        rejectionReasonId: params.expiredReasonId,
        leadStatusNote: params.note,
        isActive: false,
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Rejected ${result.count} open lead(s) for expiry (created_at <= ${params.cutoff.toISOString()}, LEAD_EXPIRE_DAYS=${params.leadExpireDays}).`,
      );
    }

    return result.count;
  }

  private async rejectExpiredConvertedApplications(params: {
    cutoff: Date;
    now: Date;
    note: string;
    rejectedAppStatusId: number | null;
    expiredReasonId: number;
    leadExpireDays: number;
  }): Promise<number> {
    if (!params.rejectedAppStatusId) {
      this.logger.error('Application status REJECTED is missing — skip converted-lead expiry pass.');
      return 0;
    }

    const leads = await this.prisma.client.lead.findMany({
      where: {
        expiredAt: null,
        isActive: true,
        createdAt: { lte: params.cutoff },
        leadStatus: { name: LEAD_STATUS.CONVERTED },
        applications: {
          none: {
            applicationStatus: { name: APPLICATION_STATUS.DISBURSED, isActive: true },
          },
        },
      },
      select: {
        id: true,
        applications: {
          select: {
            id: true,
            applicationStatus: { select: { name: true } },
          },
        },
      },
    });

    let processed = 0;
    for (const lead of leads) {
      const appsToReject = lead.applications.filter(
        (app) => !APPLICATION_SKIP_EXPIRY_STATUS_SET.has(app.applicationStatus.name),
      );

      await this.prisma.client.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            expiredAt: params.now,
            isActive: false,
          },
        });

        for (const app of appsToReject) {
          await tx.application.update({
            where: { id: app.id },
            data: {
              applicationStatusId: params.rejectedAppStatusId!,
              rejectionReasonId: params.expiredReasonId,
              applicationStatusNote: params.note,
            },
          });
        }
      });

      processed += 1;
    }

    if (processed > 0) {
      this.logger.log(
        `Expired ${processed} converted lead(s) and rejected undisbursed application(s) (created_at <= ${params.cutoff.toISOString()}, LEAD_EXPIRE_DAYS=${params.leadExpireDays}).`,
      );
    }

    return processed;
  }
}
