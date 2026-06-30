import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { APPLICATION_STATUS } from '../constants/application.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KYC_VENDOR_TECHNICAL_ISSUE_LEAD_NOTE } from '../constants/kyc.constants';
import { buildVendor5xxNote } from './vendor-api-error.util';

@Injectable()
export class VendorInternalErrorService {
  private readonly logger = new Logger(VendorInternalErrorService.name);

  constructor(
    private readonly prisma: PrismaService,
    // `forwardRef` breaks the SMS<->Vendor module cycle:
    // VendorApiService -> VendorInternalErrorService -> SmsService ->
    // SmsVendorService -> VendorApiService.
    @Inject(forwardRef(() => SmsService))
    private readonly sms: SmsService,
  ) {}

  /**
   * Marks the lead (and latest application when present) as INTERNAL_ERROR and
   * notifies the customer via the technical-issue SMS template.
   */
  async handleVendor5xx(params: {
    leadId: bigint;
    providerName: string;
    serviceName: string;
    httpStatus: number | null;
    body: unknown;
    transportError?: string;
  }): Promise<void> {
    await this.markLeadInternalError({
      leadId: params.leadId,
      note: buildVendor5xxNote(params),
      logContext: `vendor 5XX (${params.providerName}/${params.serviceName})`,
    });
  }

  /** Vendor auth / configuration failure (e.g. invalid Tenacio `x-api-key`) during customer KYC. */
  async handleVendorTechnicalIssue(params: {
    leadId: bigint;
    providerName: string;
    serviceName: string;
    note?: string;
  }): Promise<void> {
    const note = (params.note?.trim() || KYC_VENDOR_TECHNICAL_ISSUE_LEAD_NOTE).slice(0, 256);
    await this.markLeadInternalError({
      leadId: params.leadId,
      note,
      logContext: `vendor technical issue (${params.providerName}/${params.serviceName})`,
    });
  }

  private async markLeadInternalError(params: {
    leadId: bigint;
    note: string;
    logContext: string;
  }): Promise<void> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: params.leadId },
      select: {
        id: true,
        leadStatus: { select: { name: true } },
        customer: { select: { mobileNumber: true } },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!lead) {
      this.logger.warn(`Lead ${params.leadId.toString()} not found — skipping INTERNAL_ERROR escalation.`);
      return;
    }

    const alreadyInternalError = lead.leadStatus.name === LEAD_STATUS.INTERNAL_ERROR;
    const applicationId = lead.applications[0]?.id;

    const [internalLeadStatus, internalAppStatus] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.INTERNAL_ERROR, isActive: true },
        select: { id: true },
      }),
      applicationId
        ? this.prisma.client.applicationStatus.findFirst({
            where: { name: APPLICATION_STATUS.INTERNAL_ERROR, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!internalLeadStatus) {
      this.logger.warn('LeadStatus INTERNAL_ERROR not found — run seed; skipping status update.');
      return;
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: params.leadId },
        data: {
          leadStatusId: internalLeadStatus.id,
          leadStatusNote: params.note,
        },
      });

      if (applicationId && internalAppStatus) {
        await tx.application.update({
          where: { id: applicationId },
          data: { applicationStatusId: internalAppStatus.id },
        });
      } else if (applicationId && !internalAppStatus) {
        this.logger.warn(
          `ApplicationStatus ${APPLICATION_STATUS.INTERNAL_ERROR} not found — run seed; lead updated only.`,
        );
      }
    });

    this.logger.warn(
      `Lead ${params.leadId.toString()} marked INTERNAL_ERROR after ${params.logContext}.`,
    );

    if (alreadyInternalError) return;

    const mobile = lead.customer.mobileNumber?.trim();
    if (!mobile) return;

    void this.sms.sendInternalErrorSms(mobile, params.leadId).catch((err) => {
      this.logger.error('Failed to send internal-error SMS', err instanceof Error ? err.stack : err);
    });
  }
}
