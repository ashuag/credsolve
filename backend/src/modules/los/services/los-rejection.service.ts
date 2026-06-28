import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { SmsService } from '../../../common/sms/sms.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RejectWorkspaceRecordDto } from '../dto/reject-workspace-record.dto';

const TERMINAL_LEAD_STATUSES = new Set<string>([LEAD_STATUS.REJECTED, LEAD_STATUS.BLACKLISTED]);

const TERMINAL_APPLICATION_STATUSES = new Set<string>([
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.KYC_FAILED,
  APPLICATION_STATUS.CANCELLED,
  APPLICATION_STATUS.DISBURSED,
  APPLICATION_STATUS.ACTIVE,
]);

@Injectable()
export class LosRejectionService {
  private readonly logger = new Logger(LosRejectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async rejectLead(leadUuid: string, dto: RejectWorkspaceRecordDto) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      select: {
        id: true,
        uuid: true,
        customerId: true,
        leadStatus: { select: { name: true } },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (TERMINAL_LEAD_STATUSES.has(lead.leadStatus.name)) {
      throw new BadRequestException(`Lead is already ${lead.leadStatus.name.toLowerCase()}.`);
    }

    await this.rejectLeadById({
      leadId: lead.id,
      customerId: lead.customerId,
      rejectionReasonCode: dto.rejectionReasonCode,
      notes: dto.notes,
    });

    return { success: true, leadUuid: lead.uuid };
  }

  async rejectApplication(applicationUuid: string, dto: RejectWorkspaceRecordDto) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        id: true,
        uuid: true,
        leadId: true,
        customerId: true,
        applicationStatus: { select: { name: true } },
        lead: {
          select: {
            uuid: true,
            leadStatus: { select: { name: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (TERMINAL_APPLICATION_STATUSES.has(application.applicationStatus.name)) {
      throw new BadRequestException(
        `Application is already ${application.applicationStatus.name.toLowerCase().replace(/_/g, ' ')}.`,
      );
    }

    const rejectedAppStatus = await this.prisma.client.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.REJECTED, isActive: true },
      select: { id: true },
    });

    if (!rejectedAppStatus) {
      throw new BadRequestException('Application status REJECTED is not configured.');
    }

    const leadUpdate = TERMINAL_LEAD_STATUSES.has(application.lead.leadStatus.name)
      ? null
      : await this.buildLeadRejectionUpdate(dto.rejectionReasonCode, dto.notes);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { applicationStatusId: rejectedAppStatus.id },
      });

      if (leadUpdate) {
        await tx.lead.update({
          where: { id: application.leadId },
          data: leadUpdate,
        });
      }
    });

    if (leadUpdate) {
      await this.sendRejectionSms(application.customerId, application.leadId);
    }

    return { success: true, applicationUuid: application.uuid, leadUuid: application.lead.uuid };
  }

  private async rejectLeadById(params: {
    leadId: bigint;
    customerId: bigint;
    rejectionReasonCode: string;
    notes?: string;
  }): Promise<void> {
    const leadUpdate = await this.buildLeadRejectionUpdate(params.rejectionReasonCode, params.notes);

    await this.prisma.client.lead.update({
      where: { id: params.leadId },
      data: leadUpdate,
    });

    await this.sendRejectionSms(params.customerId, params.leadId);
  }

  private async buildLeadRejectionUpdate(rejectionReasonCode: string, notes?: string) {
    const [rejectedLeadStatus, rejectionReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.rejectionReason.findFirst({
        where: { name: rejectionReasonCode, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!rejectedLeadStatus) {
      throw new BadRequestException('Lead status REJECTED is not configured.');
    }

    if (!rejectionReason) {
      throw new BadRequestException('Invalid or inactive rejection reason.');
    }

    return {
      leadStatusId: rejectedLeadStatus.id,
      leadStatusNote: notes?.trim().slice(0, 256) ?? null,
      rejectionReasonId: rejectionReason.id,
    };
  }

  private async sendRejectionSms(customerId: bigint, leadId: bigint): Promise<void> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id: customerId },
      select: { mobileNumber: true },
    });
    const mobile = customer?.mobileNumber?.trim();
    if (!mobile) return;

    void this.sms.sendRejectionSms(mobile, leadId).catch((err) => {
      this.logger.error('Failed to send rejection SMS', err instanceof Error ? err.stack : err);
    });
  }
}
