import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { APPLICATION_STATUS } from '../constants/application.constants';
import { LEAD_STATUS } from '../constants/lead.constants';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KYC_VENDOR_TECHNICAL_ISSUE_LEAD_NOTE } from '../constants/kyc.constants';
import { buildVendor5xxNote } from './vendor-api-error.util';
import {
  classifyVendorApiLogOutcome,
  parseVendorServiceFromLeadStatusNote,
} from './vendor-api-log-outcome.util';

type LatestVendorLogRow = {
  httpStatus: number | null;
  responsePayload: unknown;
  respondedAt: Date;
};

function resolveLivenessAuditServiceName(): string {
  return (process.env.TENACIO_LIVENESS_AUDIT_SERVICE ?? 'liveness').trim() || 'liveness';
}

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
      providerName: params.providerName,
      serviceName: params.serviceName,
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
      providerName: params.providerName,
      serviceName: params.serviceName,
      note,
      logContext: `vendor technical issue (${params.providerName}/${params.serviceName})`,
    });
  }

  /**
   * When the latest vendor log for each service on a lead is success, revert
   * `INTERNAL_ERROR` back to `IN_PROGRESS` (e.g. liveness 505 then later 200).
   * Returns `true` when the lead was recovered.
   */
  async recoverLeadIfVendorFailuresCleared(
    leadId: bigint,
    providerName: string,
  ): Promise<boolean> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        leadStatusNote: true,
        leadStatus: { select: { name: true } },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, applicationStatus: { select: { name: true } } },
        },
      },
    });

    if (!lead || lead.leadStatus.name !== LEAD_STATUS.INTERNAL_ERROR) {
      return false;
    }

    const noteTarget = parseVendorServiceFromLeadStatusNote(lead.leadStatusNote);
    const servicesToCheck = noteTarget?.serviceName
      ? [noteTarget.serviceName]
      : [resolveLivenessAuditServiceName()];

    for (const serviceName of servicesToCheck) {
      const latest = await this.findLatestVendorLogForLead(leadId, serviceName);
      if (!latest) {
        this.logger.debug(
          `Recovery skipped for lead ${leadId.toString()}: no vendor log for "${serviceName}".`,
        );
        return false;
      }
      const outcome = classifyVendorApiLogOutcome(latest.httpStatus, latest.responsePayload);
      if (outcome === 'failure') {
        this.logger.log(
          `Recovery blocked for lead ${leadId.toString()}: latest "${serviceName}" vendor log is still failure.`,
        );
        return false;
      }
    }

    const [inProgressLeadStatus, inReviewAppStatus] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.IN_PROGRESS, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.IN_REVIEW, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!inProgressLeadStatus) {
      this.logger.warn('LeadStatus IN_PROGRESS not found — cannot recover from INTERNAL_ERROR.');
      return false;
    }

    const applicationId = lead.applications[0]?.id;
    const applicationWasInternalError =
      lead.applications[0]?.applicationStatus.name === APPLICATION_STATUS.INTERNAL_ERROR;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          leadStatusId: inProgressLeadStatus.id,
          leadStatusNote: null,
        },
      });

      if (applicationId && applicationWasInternalError && inReviewAppStatus) {
        await tx.application.update({
          where: { id: applicationId },
          data: { applicationStatusId: inReviewAppStatus.id },
        });
      }
    });

    this.logger.log(
      `Lead ${leadId.toString()} recovered to IN_PROGRESS — latest ${servicesToCheck.join(', ')} vendor log(s) are success.`,
    );
    return true;
  }

  /**
   * After a successful vendor call is audited, attempt recovery when this service's
   * latest log is now success.
   */
  async maybeRecoverLeadAfterVendorSuccess(params: {
    leadId: bigint;
    providerName: string;
    serviceName: string;
  }): Promise<void> {
    const latest = await this.findLatestVendorLogForLead(params.leadId, params.serviceName);
    if (!latest) return;
    if (classifyVendorApiLogOutcome(latest.httpStatus, latest.responsePayload) !== 'success') {
      return;
    }
    await this.recoverLeadIfVendorFailuresCleared(params.leadId, params.providerName);
  }

  private async findLatestVendorLogForLead(
    leadId: bigint,
    serviceName: string,
  ): Promise<LatestVendorLogRow | null> {
    const normalized = serviceName.trim();
    if (!normalized) return null;

    return this.prisma.client.vendorApiLog.findFirst({
      where: {
        leadId,
        serviceName: normalized,
      },
      orderBy: [{ respondedAt: 'desc' }, { id: 'desc' }],
      select: {
        httpStatus: true,
        responsePayload: true,
        respondedAt: true,
      },
    });
  }

  private async findLatestVendorLog(
    leadId: bigint,
    _providerName: string,
    serviceName: string,
  ): Promise<LatestVendorLogRow | null> {
    return this.findLatestVendorLogForLead(leadId, serviceName);
  }

  /** Only escalate when the latest audited row for this service is still a failure. */
  private async shouldEscalateFromLatestVendorLog(
    leadId: bigint,
    providerName: string,
    serviceName: string,
  ): Promise<boolean> {
    const latest = await this.findLatestVendorLog(leadId, providerName, serviceName);
    if (!latest) return true;
    return classifyVendorApiLogOutcome(latest.httpStatus, latest.responsePayload) === 'failure';
  }

  private async markLeadInternalError(params: {
    leadId: bigint;
    note: string;
    logContext: string;
    providerName: string;
    serviceName: string;
  }): Promise<void> {
    const shouldEscalate = await this.shouldEscalateFromLatestVendorLog(
      params.leadId,
      params.providerName,
      params.serviceName,
    );
    if (!shouldEscalate) {
      this.logger.log(
        `Skipping INTERNAL_ERROR (${params.logContext}) — latest ${params.providerName}/${params.serviceName} vendor log is success.`,
      );
      return;
    }

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
