import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PostBreCheckService } from '../../../common/bre/post-bre-check.service';
import { BureauReportPdfService } from '../../../common/cibil/bureau-report-pdf.service';
import { CibilCreditAssessmentService } from '../../../common/cibil/cibil-credit-assessment.service';
import { computeOpenUnsecuredExposureBreakdown } from '../../../common/cibil/cibil-tradeline.parser';
import { CreditLimitTierResolverService } from '../../../common/cibil/credit-limit-tier-resolver.service';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { BUREAU_FETCHED } from '../../../common/constants/bureau-fetch.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { REJECTION_REASON, toRejectionReasonDto } from '../../../common/constants/rejection-reason.constants';
import { generateLeadNumber } from '../../../common/loan/application-number.util';
import { isCustomerJourneyComplete } from '../../../common/loan/customer-journey-complete.util';
import { SmsService } from '../../../common/sms/sms.service';
import { BureauFetchService } from '../../../common/vendor/bureau-fetch.service';
import { mapCibilVendorName } from '../../../common/vendor/cibil-vendor.util';
import { mapCibil07SoftPullToTenacioEnvelope } from '../../../common/vendor/cibil07/cibil07-cibil-to-tenacio.mapper';
import { mapSurepassCibilToTenacioEnvelope } from '../../../common/vendor/surepass/surepass-cibil-to-tenacio.mapper';
import { unwrapVendorApiLogPayload } from '../../../common/vendor/vendor-api-log-payload.util';
import {
  isTenacioBureauClientError,
  isTenacioBureauSuccessPayload,
  parseTenacioBureauEnvelope,
  parseTenacioBureauVendorBody,
  tenacioBureauFailureNote,
} from '../../../common/vendor/tenacio-bureau-payload.mapper';
import { PrismaService } from '../../../prisma/prisma.service';
import { BureauReportRepository } from '../../auth/infrastructure/repositories/bureau-report.repository';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const CONVERTIBLE_LEAD_STATUSES = new Set<string>([LEAD_STATUS.NEW, LEAD_STATUS.IN_PROGRESS]);

const BUREAU_SOFT_PULL_FAIL_NOTE = 'Bureau soft-pull failed: credit bureau returned a non-success response.';

/** True when this lead was auto-rejected for a recoverable bureau soft-pull failure. */
export function isRecoverableBureauSoftPullRejection(lead: {
  leadStatus: { name: string };
  leadStatusNote?: string | null;
  rejectionReason?: { name: string } | null;
}): boolean {
  if (lead.leadStatus.name !== LEAD_STATUS.REJECTED) return false;
  if (lead.rejectionReason?.name === REJECTION_REASON.BUREAU_SOFT_PULL_FAILED) return true;
  const note = lead.leadStatusNote?.trim() ?? '';
  // Legacy auto-rejects used REJECTED_BY_CLIENTS with this soft-pull note.
  return note.startsWith('Bureau soft-pull failed');
}

export const CIBIL_HIT_SERVICE_NAME_FILTERS = ['cibil', 'experian', 'credit-report'] as const;

export type LosCibilHitKind = 'vendor' | 'report';

export type LosCibilHitLog = {
  id: string;
  kind: LosCibilHitKind;
  at: string;
  providerName: string | null;
  serviceName: string | null;
  httpStatus: number | null;
  outcome: 'success' | 'failure';
  dummyFetched: boolean;
  vendorLogUuid: string | null;
  bureauReportUuid: string | null;
  /** Raw vendor HTTP body stored on `vendor_api_log.response_payload`. */
  originalJson: unknown | null;
  /**
   * Vendor payload converted to a Tenacio-style bureau response
   * (`status` / `serviceStatusCode` / `data.cibilData…`) — what BRE and the CIBIL report consume.
   */
  wrappedJson: unknown | null;
};

export type LosCibilHitsPayload = {
  hitCount: number;
  hits: LosCibilHitLog[];
};

export type LosCheckCibilOutcome =
  | 'fetched_and_passed'
  | 'post_bre_failed'
  | 'ntc'
  | 'bureau_identity_failed'
  | 'bureau_failed'
  | 'not_configured';

export type LosCheckCibilResult = LosCibilHitsPayload & {
  ok: boolean;
  rejected: boolean;
  outcome: LosCheckCibilOutcome;
  message: string;
  cibilScore: number | null;
  bureauFetched: number;
  leadStatusCode: string;
  leadStatusLabel: string;
  rejectionReason: { code: string; label: string } | null;
  postBre: {
    passed: boolean;
    rejectReason: string | null;
    rejectionReasonCode: string | null;
  } | null;
};

export function isCibilVendorServiceName(serviceName: string): boolean {
  const normalized = serviceName.trim().toLowerCase();
  return CIBIL_HIT_SERVICE_NAME_FILTERS.some((token) => normalized.includes(token));
}

function hitOutcomeFromHttpStatus(httpStatus: number | null): 'success' | 'failure' {
  if (httpStatus == null) return 'failure';
  return httpStatus >= 200 && httpStatus < 300 ? 'success' : 'failure';
}

/** Convert a stored vendor CIBIL body into a Tenacio-shaped bureau response JSON. */
export function wrapCibilHitJson(params: {
  providerName: string | null;
  serviceName: string | null;
  httpStatus: number | null;
  originalJson: unknown;
}): unknown {
  const original = unwrapVendorApiLogPayload(params.originalJson);
  if (original == null) return null;
  const service = (params.serviceName ?? '').toLowerCase();
  const kind = mapCibilVendorName(params.providerName ?? '');
  try {
    if (kind === 'cibil07' || service.includes('cibil-soft-pull')) {
      return mapCibil07SoftPullToTenacioEnvelope(original, params.httpStatus);
    }
    if (kind === 'surepass' || service.includes('credit-report-cibil')) {
      return mapSurepassCibilToTenacioEnvelope(original, params.httpStatus);
    }
    return original;
  } catch {
    return original;
  }
}

@Injectable()
export class LosCheckCibilService {
  private readonly logger = new Logger(LosCheckCibilService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bureauFetch: BureauFetchService,
    private readonly bureauReports: BureauReportRepository,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly cibilCreditAssessment: CibilCreditAssessmentService,
    private readonly postBreCheck: PostBreCheckService,
    private readonly creditLimitTiers: CreditLimitTierResolverService,
    private readonly sms: SmsService,
  ) {}

  async checkForLead(leadUuid: string): Promise<LosCheckCibilResult> {
    const lead = await this.loadLead(leadUuid);
    this.assertLeadCanBeChecked(lead);

    const name = lead.leadDetail.fullName?.trim() ?? '';
    const pan = lead.leadDetail.panNumber?.trim().toUpperCase() ?? '';
    const mobile = lead.customer.mobileNumber.trim();

    if (!name || pan.length !== 10) {
      throw new BadRequestException('Full name and a 10-character PAN are required on the lead before checking CIBIL.');
    }
    if (!INDIAN_MOBILE.test(mobile)) {
      throw new BadRequestException('Customer mobile must be a 10-digit Indian number before checking CIBIL.');
    }

    const out = await this.bureauFetch.fetchBureauFromTenacio(
      { input: { mobileNumber: mobile, name, panNumber: pan, consent: true } },
      lead.id,
    );

    if (!out.configured) {
      const hits = await this.listHitsForLead(lead.id, lead.customerId, lead.createdAt);
      return {
        ok: false,
        rejected: false,
        outcome: 'not_configured',
        message: out.skipReason ?? 'CIBIL vendor is not configured.',
        cibilScore: null,
        bureauFetched: lead.leadDetail.bureauFetched,
        leadStatusCode: lead.leadStatus.name,
        leadStatusLabel: lead.leadStatus.displayName?.trim() || lead.leadStatus.name,
        rejectionReason: toRejectionReasonDto(lead.rejectionReason),
        postBre: null,
        ...hits,
      };
    }

    const now = new Date();

    if (out.isNewToCredit) {
      await this.markBureauFetched(lead.id, BUREAU_FETCHED.FAILED, now, `NTC: ${out.serviceErrorMessage ?? 'no matching credit record'}`);
      if (out.vendorBody != null) {
        await this.persistSnapshot(lead, out.vendorBody, out.httpStatus, out.dummyPayload);
      }
      await this.rejectLeadAndApplication({
        leadId: lead.id,
        customerId: lead.customerId,
        note: 'New to credit: bureau holds no matching credit record for this customer.',
        rejectionReasonCode: REJECTION_REASON.NEW_TO_CREDIT,
        ineligibleReason: out.serviceErrorMessage,
      });
      return this.buildResult(lead.uuid, {
        ok: true,
        rejected: true,
        outcome: 'ntc',
        message: 'CIBIL returned new-to-credit. The lead has been rejected.',
        cibilScore: null,
        postBre: {
          passed: false,
          rejectReason: 'New to credit: bureau holds no matching credit record for this customer.',
          rejectionReasonCode: REJECTION_REASON.NEW_TO_CREDIT,
        },
      });
    }

    const bureauSucceeded =
      out.httpStatus === 200 && out.vendorBody != null && isTenacioBureauSuccessPayload(out.vendorBody);

    if (bureauSucceeded) {
      await this.markBureauFetched(lead.id, BUREAU_FETCHED.SUCCESS, now, null);
      await this.persistSnapshot(lead, out.vendorBody, out.httpStatus, out.dummyPayload);
      return this.runPostBreAndSettle(lead);
    }

    const envelope = out.vendorBody != null ? parseTenacioBureauEnvelope(out.vendorBody) : null;
    if (out.httpStatus === 200 && envelope != null && isTenacioBureauClientError(envelope.serviceStatusCode)) {
      const leadNote = (envelope.serviceErrorMessage ?? 'Bureau identity verification failed').slice(0, 256);
      const bureauNote = tenacioBureauFailureNote(out.vendorBody, out.httpStatus).slice(0, 500);
      await this.markBureauFetched(lead.id, BUREAU_FETCHED.FAILED, now, bureauNote);
      await this.rejectLeadAndApplication({
        leadId: lead.id,
        customerId: lead.customerId,
        note: leadNote,
        rejectionReasonCode: REJECTION_REASON.BUREAU_IDENTITY_MISMATCH,
        ineligibleReason: leadNote,
      });
      return this.buildResult(lead.uuid, {
        ok: true,
        rejected: true,
        outcome: 'bureau_identity_failed',
        message: 'Bureau identity check failed. The lead has been rejected.',
        cibilScore: null,
        postBre: {
          passed: false,
          rejectReason: leadNote,
          rejectionReasonCode: REJECTION_REASON.BUREAU_IDENTITY_MISMATCH,
        },
      });
    }

    const failNote = tenacioBureauFailureNote(out.vendorBody, out.httpStatus);
    const note = failNote.includes('http=')
      ? failNote
      : `http=${out.httpStatus ?? 'n/a'} err=${out.error?.message ?? 'vendor'}`.slice(0, 500);
    await this.markBureauFetched(lead.id, BUREAU_FETCHED.FAILED, now, note);
    await this.rejectLeadAndApplication({
      leadId: lead.id,
      customerId: lead.customerId,
      note: BUREAU_SOFT_PULL_FAIL_NOTE,
      rejectionReasonCode: REJECTION_REASON.BUREAU_SOFT_PULL_FAILED,
      ineligibleReason: note,
    });
    return this.buildResult(lead.uuid, {
      ok: true,
      rejected: true,
      outcome: 'bureau_failed',
      message: 'CIBIL fetch failed. The lead has been rejected.',
      cibilScore: null,
      postBre: null,
    });
  }

  async checkForApplication(applicationUuid: string): Promise<LosCheckCibilResult> {
    return this.checkForLead(await this.resolveLeadUuidForApplication(applicationUuid));
  }

  async listHitsForLeadUuid(leadUuid: string): Promise<LosCibilHitsPayload> {
    const lead = await this.prisma.read.lead.findUnique({
      where: { uuid: leadUuid },
      select: { id: true, customerId: true, createdAt: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return this.safeListHits(lead.id, lead.customerId, lead.createdAt);
  }

  async listHitsForApplication(applicationUuid: string): Promise<LosCibilHitsPayload> {
    return this.listHitsForLeadUuid(await this.resolveLeadUuidForApplication(applicationUuid));
  }

  async listHitsForLead(
    leadId: bigint,
    customerId: bigint,
    leadCreatedAt: Date,
  ): Promise<LosCibilHitsPayload> {
    const vendorRows = await this.prisma.read.vendorApiLog.findMany({
      where: {
        leadId,
        OR: CIBIL_HIT_SERVICE_NAME_FILTERS.map((token) => ({
          serviceName: { contains: token },
        })),
      },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        uuid: true,
        providerName: true,
        serviceName: true,
        httpStatus: true,
        requestedAt: true,
        responsePayload: true,
      },
    });

    const vendorHits = vendorRows
      .filter((row) => isCibilVendorServiceName(row.serviceName))
      .map((row) => {
        const originalJson = unwrapVendorApiLogPayload(row.responsePayload ?? null);
        return {
          id: `vendor:${row.uuid}`,
          kind: 'vendor' as const,
          at: row.requestedAt.toISOString(),
          providerName: row.providerName,
          serviceName: row.serviceName,
          httpStatus: row.httpStatus,
          outcome: hitOutcomeFromHttpStatus(row.httpStatus),
          dummyFetched: false,
          vendorLogUuid: row.uuid,
          bureauReportUuid: null,
          originalJson,
          wrappedJson: wrapCibilHitJson({
            providerName: row.providerName,
            serviceName: row.serviceName,
            httpStatus: row.httpStatus,
            originalJson,
          }),
        };
      });

    if (vendorHits.length > 0) {
      return { hitCount: vendorHits.length, hits: vendorHits };
    }

    const reports = await this.prisma.read.bureauReport.findMany({
      where: { customerId, createdAt: { gte: leadCreatedAt } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        dummyFetched: true,
        serviceStatusCode: true,
        createdAt: true,
        rawPayload: true,
        vendorName: true,
      },
    });

    const reportHits = reports.map((row) => ({
      id: `report:${row.uuid}`,
      kind: 'report' as const,
      at: row.createdAt.toISOString(),
      providerName: row.dummyFetched ? 'mock' : row.vendorName,
      serviceName: 'bureau-report',
      httpStatus: row.serviceStatusCode,
      outcome: (row.serviceStatusCode == null || (row.serviceStatusCode >= 200 && row.serviceStatusCode < 300)
        ? 'success'
        : 'failure') as 'success' | 'failure',
      dummyFetched: Boolean(row.dummyFetched),
      vendorLogUuid: null,
      bureauReportUuid: row.uuid,
      originalJson: null,
      wrappedJson: row.rawPayload ?? null,
    }));

    return { hitCount: reportHits.length, hits: reportHits };
  }

  private async safeListHits(
    leadId: bigint,
    customerId: bigint,
    leadCreatedAt: Date,
  ): Promise<LosCibilHitsPayload> {
    try {
      return await this.listHitsForLead(leadId, customerId, leadCreatedAt);
    } catch (err) {
      this.logger.warn(
        `CIBIL hit log skipped (leadId=${leadId.toString()}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { hitCount: 0, hits: [] };
    }
  }

  private async runPostBreAndSettle(
    lead: Awaited<ReturnType<LosCheckCibilService['loadLead']>>,
  ): Promise<LosCheckCibilResult> {
    try {
      await this.cibilCreditAssessment.runForLead(lead.id);
    } catch (err) {
      this.logger.error(
        `CIBIL credit assessment failed (leadId=${lead.id.toString()}); continuing to post-BRE.`,
        err instanceof Error ? err.stack : err,
      );
    }

    const postBre = await this.postBreCheck.run({
      leadId: lead.id,
      customerId: lead.customerId,
    });

    if (!postBre.passed) {
      await this.rejectLeadAndApplication({
        leadId: lead.id,
        customerId: lead.customerId,
        note: postBre.rejectReason ?? 'Post-BRE check failed',
        rejectionReasonCode: postBre.rejectionReasonCode,
        ineligibleReason: postBre.rejectReason,
      });
      return this.buildResult(lead.uuid, {
        ok: true,
        rejected: true,
        outcome: 'post_bre_failed',
        message: postBre.rejectReason
          ? `Post-BRE failed: ${postBre.rejectReason}. The lead has been rejected.`
          : 'Post-BRE failed. The lead has been rejected.',
        cibilScore: postBre.cibilScore,
        postBre: {
          passed: false,
          rejectReason: postBre.rejectReason,
          rejectionReasonCode: postBre.rejectionReasonCode,
        },
      });
    }

    const recoverableSoftPull = isRecoverableBureauSoftPullRejection(lead);

    if (recoverableSoftPull) {
      try {
        const restored = await this.restoreAfterBureauSoftPullSuccess(lead);
        return this.buildResult(lead.uuid, {
          ok: true,
          rejected: false,
          outcome: 'fetched_and_passed',
          message: restored.journeyComplete
            ? 'CIBIL re-fetched and post-BRE passed. Journey is complete — application moved to IN_REVIEW.'
            : 'CIBIL re-fetched and post-BRE passed. Lead restored so the customer can continue where they left off.',
          cibilScore: postBre.cibilScore,
          postBre: {
            passed: true,
            rejectReason: null,
            rejectionReasonCode: null,
          },
        });
      } catch (err) {
        this.logger.error(
          `Post-BRE passed but soft-pull recovery failed (leadId=${lead.id.toString()}).`,
          err instanceof Error ? err.stack : err,
        );
      }
    } else if (CONVERTIBLE_LEAD_STATUSES.has(lead.leadStatus.name)) {
      try {
        await this.convertLeadWithOffer(lead.id, lead.customerId);
      } catch (err) {
        this.logger.error(
          `Post-BRE passed but offer persistence failed (leadId=${lead.id.toString()}).`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    return this.buildResult(lead.uuid, {
      ok: true,
      rejected: false,
      outcome: 'fetched_and_passed',
      message: 'CIBIL fetched and post-BRE passed.',
      cibilScore: postBre.cibilScore,
      postBre: {
        passed: true,
        rejectReason: null,
        rejectionReasonCode: null,
      },
    });
  }

  /**
   * After a recoverable bureau soft-pull rejection, a successful re-fetch + post-BRE
   * clears the reject and resumes the journey. If every customer stage is already done,
   * the application (and lead handoff) land in IN_REVIEW.
   */
  private async restoreAfterBureauSoftPullSuccess(
    lead: Awaited<ReturnType<LosCheckCibilService['loadLead']>>,
  ): Promise<{ journeyComplete: boolean }> {
    const application = await this.prisma.client.application.findFirst({
      where: { leadId: lead.id, customerId: lead.customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kyc: { select: { kycStatus: true, kycCompletedAt: true } },
        details: {
          select: {
            selectedLoanAmount: true,
            emailVerifiedAt: true,
            loanDocumentsAcceptedAt: true,
            bankAccountNumber: true,
          },
        },
        _count: { select: { references: true } },
      },
    });

    const journeyComplete = isCustomerJourneyComplete({
      fullName: lead.leadDetail.fullName,
      panVerified: lead.leadDetail.panVerified,
      bureauFetched: BUREAU_FETCHED.SUCCESS,
      hasBureauReport: true,
      selectedLoanAmount: application?.details?.selectedLoanAmount,
      emailVerifiedAt: application?.details?.emailVerifiedAt,
      loanDocumentsAcceptedAt: application?.details?.loanDocumentsAcceptedAt,
      kycStatus: application?.kyc?.kycStatus,
      kycCompletedAt: application?.kyc?.kycCompletedAt,
      bankAccountNumber: application?.details?.bankAccountNumber,
      referencesCount: application?._count.references ?? 0,
    });

    // Resume past the offer stage when the customer already progressed beyond it.
    const progressedPastOffer = Boolean(
      application?.details?.bankAccountNumber?.trim() ||
        application?.details?.emailVerifiedAt ||
        application?.kyc?.kycCompletedAt ||
        application?.details?.loanDocumentsAcceptedAt ||
        (application?._count.references ?? 0) > 0,
    );

    const [convertedLeadStatus, draftAppStatus, inReviewAppStatus] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.CONVERTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.DRAFT, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.IN_REVIEW, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!convertedLeadStatus) {
      throw new BadRequestException('Lead status CONVERTED is not configured.');
    }
    if (!draftAppStatus || !inReviewAppStatus) {
      throw new BadRequestException('Application statuses DRAFT / IN_REVIEW are not configured.');
    }

    const rawPayload = await this.bureauReports.findLatestRawPayloadForLead(lead.id);
    let approved: Prisma.Decimal | null = null;
    if (rawPayload != null) {
      const { totalUnsecuredExposureInr } = computeOpenUnsecuredExposureBreakdown(rawPayload);
      const tier = await this.creditLimitTiers.resolveMaxBulletLoan(totalUnsecuredExposureInr);
      if (tier) {
        approved = new Prisma.Decimal(tier.maxBulletLoan);
      }
    }

    const appStatusId =
      journeyComplete || progressedPastOffer ? inReviewAppStatus.id : draftAppStatus.id;
    const appStatusName =
      journeyComplete || progressedPastOffer ? APPLICATION_STATUS.IN_REVIEW : APPLICATION_STATUS.DRAFT;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          leadStatusId: convertedLeadStatus.id,
          leadStatusNote: null,
          rejectionReasonId: null,
        },
      });

      const app = application ?? (await this.ensureDraftApplication(tx, lead.id, lead.customerId));
      await tx.application.update({
        where: { id: app.id },
        data: {
          applicationStatusId: appStatusId,
          applicationStatusNote: null,
          rejectionReasonId: null,
          ...(approved ? { preApprovedLoanAmount: approved } : {}),
        },
      });
    });

    this.logger.log(
      `Recovered lead after bureau soft-pull re-fetch (leadId=${lead.id.toString()}): ` +
        `journeyComplete=${journeyComplete} appStatus=${appStatusName}`,
    );

    return { journeyComplete };
  }

  private async convertLeadWithOffer(leadId: bigint, customerId: bigint): Promise<void> {
    const convertedLeadStatus = await this.prisma.client.leadStatus.findFirst({
      where: { name: LEAD_STATUS.CONVERTED, isActive: true },
      select: { id: true },
    });
    if (!convertedLeadStatus) {
      this.logger.warn('LeadStatus CONVERTED not found — skipping conversion after post-BRE pass.');
      return;
    }

    const rawPayload = await this.bureauReports.findLatestRawPayloadForLead(leadId);
    let approved: Prisma.Decimal | null = null;
    if (rawPayload != null) {
      const { totalUnsecuredExposureInr } = computeOpenUnsecuredExposureBreakdown(rawPayload);
      const tier = await this.creditLimitTiers.resolveMaxBulletLoan(totalUnsecuredExposureInr);
      if (tier) {
        approved = new Prisma.Decimal(tier.maxBulletLoan);
      }
    }

    await this.prisma.client.$transaction(async (tx) => {
      const application = await this.ensureDraftApplication(tx, leadId, customerId);
      if (approved) {
        await tx.application.update({
          where: { id: application.id },
          data: { preApprovedLoanAmount: approved },
        });
      }
      await tx.lead.update({
        where: { id: leadId },
        data: { leadStatusId: convertedLeadStatus.id },
      });
    });
  }

  private async rejectLeadAndApplication(params: {
    leadId: bigint;
    customerId: bigint;
    note: string;
    rejectionReasonCode: string | null;
    ineligibleReason: string | null;
  }): Promise<void> {
    const [rejectedLeadStatus, rejectedAppStatus, rejectionReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      this.prisma.client.applicationStatus.findFirst({
        where: { name: APPLICATION_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      params.rejectionReasonCode
        ? this.prisma.client.rejectionReason.findFirst({
            where: { name: params.rejectionReasonCode, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!rejectedLeadStatus) {
      this.logger.warn('LeadStatus REJECTED not found — skipping LOS CIBIL rejection.');
      return;
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

      const application = await this.ensureDraftApplication(tx, params.leadId, params.customerId);
      if (rejectedAppStatus) {
        await tx.application.update({
          where: { id: application.id },
          data: {
            applicationStatusId: rejectedAppStatus.id,
            preApprovedLoanAmount: null,
            applicationStatusNote: (params.ineligibleReason ?? params.note).slice(0, 256),
          },
        });
      }
    });

    const customer = await this.prisma.client.customer.findUnique({
      where: { id: params.customerId },
      select: { mobileNumber: true },
    });
    const mobile = customer?.mobileNumber?.trim();
    if (mobile) {
      void this.sms.sendRejectionSms(mobile, params.leadId).catch((err) => {
        this.logger.error('Failed to send rejection SMS', err instanceof Error ? err.stack : err);
      });
    }
  }

  private async ensureDraftApplication(
    tx: Prisma.TransactionClient,
    leadId: bigint,
    customerId: bigint,
  ) {
    const existing = await tx.application.findFirst({
      where: { leadId, customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const draftStatus = await tx.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.DRAFT, isActive: true },
      select: { id: true },
    });
    if (!draftStatus) {
      throw new BadRequestException('Application status DRAFT is not configured.');
    }

    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { leadNumber: true },
    });
    let journeyNumber = lead?.leadNumber?.trim() || '';
    if (!journeyNumber) {
      journeyNumber = generateLeadNumber();
      await tx.lead.update({
        where: { id: leadId },
        data: { leadNumber: journeyNumber },
      });
    }

    return tx.application.create({
      data: {
        customerId,
        leadId,
        applicationStatusId: draftStatus.id,
        applicationNumber: journeyNumber,
      },
    });
  }

  private async persistSnapshot(
    lead: { id: bigint; customerId: bigint; customer: { uuid: string } },
    vendorBody: unknown,
    httpStatus: number | null,
    dummyFetched: boolean,
  ): Promise<void> {
    try {
      const parsed = parseTenacioBureauVendorBody(vendorBody);
      const created = await this.bureauReports.createFromVendorSnapshot({
        customerId: lead.customerId,
        leadId: lead.id,
        vendorBody,
        parsed,
        httpStatus,
        dummyFetched,
      });
      await this.bureauReportPdf.generateAndAttachForReport({
        bureauReportId: created.id,
        customerUuid: lead.customer.uuid,
        bureauReportUuid: created.uuid,
        vendorBody,
      });
    } catch (err) {
      this.logger.warn(
        `Bureau snapshot not saved (leadId=${lead.id.toString()}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async markBureauFetched(
    leadId: bigint,
    status: number,
    at: Date,
    note: string | null,
  ): Promise<void> {
    await this.prisma.client.leadDetail.update({
      where: { leadId },
      data: {
        bureauFetched: status,
        bureauFetchedAt: at,
        bureauFetchedNote: note?.slice(0, 500) ?? null,
      },
    });
  }

  private async buildResult(
    leadUuid: string,
    partial: Omit<LosCheckCibilResult, 'hitCount' | 'hits' | 'bureauFetched' | 'leadStatusCode' | 'leadStatusLabel' | 'rejectionReason'>,
  ): Promise<LosCheckCibilResult> {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      select: {
        id: true,
        customerId: true,
        createdAt: true,
        leadStatus: { select: { name: true, displayName: true } },
        rejectionReason: { select: { name: true } },
        leadDetail: { select: { bureauFetched: true } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    const hits = await this.safeListHits(lead.id, lead.customerId, lead.createdAt);
    return {
      ...partial,
      bureauFetched: lead.leadDetail?.bureauFetched ?? BUREAU_FETCHED.NOT_FETCHED,
      leadStatusCode: lead.leadStatus.name,
      leadStatusLabel: lead.leadStatus.displayName?.trim() || lead.leadStatus.name,
      rejectionReason: toRejectionReasonDto(lead.rejectionReason),
      ...hits,
    };
  }

  private async loadLead(leadUuid: string) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      select: {
        id: true,
        uuid: true,
        customerId: true,
        createdAt: true,
        leadStatusNote: true,
        customer: { select: { uuid: true, mobileNumber: true } },
        leadStatus: { select: { name: true, displayName: true } },
        rejectionReason: { select: { name: true } },
        leadDetail: {
          select: {
            fullName: true,
            panNumber: true,
            panVerified: true,
            bureauFetched: true,
          },
        },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (!lead.leadDetail) {
      throw new BadRequestException('Lead profile is missing. Save name and PAN before checking CIBIL.');
    }
    return { ...lead, leadDetail: lead.leadDetail };
  }

  private assertLeadCanBeChecked(lead: { leadStatus: { name: string } }): void {
    if (lead.leadStatus.name === LEAD_STATUS.BLACKLISTED) {
      throw new BadRequestException('CIBIL cannot be checked for a blacklisted lead.');
    }
  }

  private async resolveLeadUuidForApplication(applicationUuid: string): Promise<string> {
    const application = await this.prisma.read.application.findUnique({
      where: { uuid: applicationUuid },
      select: { lead: { select: { uuid: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application.lead.uuid;
  }
}
