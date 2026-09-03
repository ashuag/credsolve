import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { DigilockerSessionStore } from '../../../../common/kyc/digilocker-session.store';
import { DigilockerFetchService } from '../../../../common/vendor/digilocker-fetch.service';
import {
  buildDigilockerAadhaarFormJson,
  buildDigilockerIdentityMismatchJson,
  buildDigilockerVendorAttemptJson,
  decodeAadhaarPhoto,
  extractAadhaarPhotoString,
  isDigilockerAadhaarCaptureComplete,
  isDigilockerSessionNotReadyError,
  isTenacioVendorBusinessSuccess,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { compareAadhaarToLeadProfile } from '../../../../common/kyc/aadhaar-lead-identity-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS } from '../../../../common/constants/kyc.constants';
import { KycDigilockerDownloadFailureService } from '../../../../common/kyc/kyc-digilocker-download-failure.service';
import { KycIdentityRejectionService } from '../../../../common/kyc/kyc-identity-rejection.service';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { APPLICATION_KYC_STATUS } from '../../../../common/constants/application.constants';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import type { DownloadAadhaarDigilockerDto } from '../dto/download-aadhaar-digilocker.dto';

const PEER_DOWNLOAD_WAIT_MS = 50_000;
const PEER_DOWNLOAD_POLL_MS = 400;
const SESSION_NOT_READY_RETRY_DELAY_MS = 2_500;

const AADHAAR_DOWNLOAD_SERVICE_NAMES = ['aadhaar-download', 'digilocker-download-aadhaar'] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function unwrapVendorAuditPayload(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if (payload.parsed != null) return payload.parsed;
  if (payload._truncated === true && payload.parsed != null) return payload.parsed;
  return payload;
}

export type DownloadAadhaarDigilockerResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  /** When HTTP succeeded but vendor business status was not success. */
  businessSuccess?: boolean;
  /** When Aadhaar JSON + optional photo were written to DB / disk. */
  persisted?: boolean;
  /** Name or DOB on Aadhaar did not match lead profile — application set to KYC_FAILED. */
  identityMismatch?: boolean;
  identityMismatchMessage?: string;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  canRetry?: boolean;
  leadRejected?: boolean;
  terminalFailure?: boolean;
  /** When Surepass also returned DigiLocker PAN. */
  panFetched?: boolean;
  panCardNumber?: string | null;
  /**
   * Another download is already in flight for this application. The vendor was not
   * called again; retry only after that attempt finishes (including failure).
   */
  skippedDuplicate?: boolean;
};

@Injectable()
export class DownloadAadhaarDigilockerUseCase {
  private readonly logger = new Logger(DownloadAadhaarDigilockerUseCase.name);
  private readonly inFlightByApplication = new Map<string, Promise<DownloadAadhaarDigilockerResult>>();

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly digilockerFetch: DigilockerFetchService,
    private readonly digilockerSession: DigilockerSessionStore,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly kycIdentityRejection: KycIdentityRejectionService,
    private readonly kycDigilockerDownloadFailure: KycDigilockerDownloadFailureService,
    private readonly kycCompletion: KycCompletionService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, dto: DownloadAadhaarDigilockerDto): Promise<DownloadAadhaarDigilockerResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
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

    const applicationRow = await this.applications.ensureDraftApplicationForLead({
      leadId: lead.id,
      customerId: customer.id,
    });
    const appKyc = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId: applicationRow.id },
      select: { kycStatus: true },
    });
    assertApplicationKycNotCompleted(appKyc?.kycStatus);

    const priorAttempts = await this.kycDigilockerDownloadFailure.readAttemptsUsed(applicationRow.id);
    if (priorAttempts >= DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS) {
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: null,
        attemptsUsed: priorAttempts,
        attemptsAllowed: DIGILOCKER_AADHAAR_DOWNLOAD_MAX_ATTEMPTS,
        canRetry: false,
        leadRejected: true,
        terminalFailure: true,
      };
    }

    const storedSession = await this.digilockerSession.readSession(applicationRow.uuid);
    let sessionToken = dto.sessionToken?.trim() ?? '';
    if (!sessionToken) {
      sessionToken = storedSession?.token ?? '';
    }
    if (!sessionToken) {
      throw new BadRequestException(
        'Missing DigiLocker session token. Start DigiLocker again from KYC (Login with DigiLocker), then return to this page.',
      );
    }

    const already = await this.snapshotDownloadOutcome(applicationRow.id, customer.id);
    if (already) {
      return already;
    }

    const existing = this.inFlightByApplication.get(applicationRow.uuid);
    if (existing) {
      return existing;
    }

    const run = this.runExclusiveDownload({
      sessionToken,
      vendorKind: storedSession?.vendor,
      leadId: lead.id,
      customerId: customer.id,
      customerUuid: customer.uuid,
      customerMobile: customer.mobileNumber,
      applicationId: applicationRow.id,
      applicationUuid: applicationRow.uuid,
    }).finally(() => {
      if (this.inFlightByApplication.get(applicationRow.uuid) === run) {
        this.inFlightByApplication.delete(applicationRow.uuid);
      }
    });
    this.inFlightByApplication.set(applicationRow.uuid, run);
    return run;
  }

  private async runExclusiveDownload(params: {
    sessionToken: string;
    vendorKind: 'surepass' | 'tenacio' | null | undefined;
    leadId: bigint;
    customerId: bigint;
    customerUuid: string;
    customerMobile?: string | null;
    applicationId: bigint;
    applicationUuid: string;
  }): Promise<DownloadAadhaarDigilockerResult> {
    const cached = await this.findSuccessfulAadhaarDownload(params.leadId);
    if (cached) {
      this.logger.log(
        `Reusing successful aadhaar-download log (leadId=${params.leadId.toString()}) without a second vendor call.`,
      );
      return this.completeFromVendorPayload({
        ...params,
        vendor: cached.vendor,
        httpStatus: cached.httpStatus,
        vendorKind: cached.vendorKind ?? params.vendorKind,
      });
    }

    const lock = await this.digilockerSession.tryAcquireDownloadLock(params.applicationUuid);
    if (!lock.acquired) {
      this.logger.log(
        `DigiLocker Aadhaar download already in flight (application=${params.applicationUuid}); waiting without a second vendor call.`,
      );
      return this.waitForPeerDownload(params);
    }

    try {
      const again = await this.findSuccessfulAadhaarDownload(params.leadId);
      if (again) {
        return this.completeFromVendorPayload({
          ...params,
          vendor: again.vendor,
          httpStatus: again.httpStatus,
          vendorKind: again.vendorKind ?? params.vendorKind,
        });
      }
      return await this.downloadFromVendor(params);
    } finally {
      await this.digilockerSession.releaseDownloadLock(params.applicationUuid, lock.token);
    }
  }

  private async snapshotDownloadOutcome(
    applicationId: bigint,
    customerId: bigint,
  ): Promise<DownloadAadhaarDigilockerResult | null> {
    const customerKyc = await this.prisma.client.customerKyc.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { aadhaarData: true },
    });
    if (isDigilockerAadhaarCaptureComplete(customerKyc?.aadhaarData)) {
      return {
        configured: true,
        ok: true,
        httpStatus: 200,
        vendor: null,
        persisted: true,
      };
    }

    const appKyc = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId },
      select: { kycStatus: true },
    });
    if (appKyc?.kycStatus === APPLICATION_KYC_STATUS.FAILED) {
      return {
        configured: true,
        ok: false,
        httpStatus: 200,
        vendor: null,
        identityMismatch: true,
        identityMismatchMessage:
          'Name or date of birth on Aadhaar does not match your loan application. This application cannot proceed.',
        leadRejected: true,
      };
    }

    return null;
  }

  private async waitForPeerDownload(params: {
    sessionToken: string;
    vendorKind: 'surepass' | 'tenacio' | null | undefined;
    leadId: bigint;
    customerId: bigint;
    customerUuid: string;
    customerMobile?: string | null;
    applicationId: bigint;
    applicationUuid: string;
  }): Promise<DownloadAadhaarDigilockerResult> {
    const deadline = Date.now() + PEER_DOWNLOAD_WAIT_MS;
    while (Date.now() < deadline) {
      const snapshot = await this.snapshotDownloadOutcome(params.applicationId, params.customerId);
      if (snapshot) return snapshot;

      const locked = await this.digilockerSession.isDownloadLocked(params.applicationUuid);
      if (!locked) {
        const after = await this.snapshotDownloadOutcome(params.applicationId, params.customerId);
        if (after) return after;
        const cached = await this.findSuccessfulAadhaarDownload(params.leadId);
        if (cached) {
          return this.completeFromVendorPayload({
            ...params,
            vendor: cached.vendor,
            httpStatus: cached.httpStatus,
            vendorKind: cached.vendorKind ?? params.vendorKind,
          });
        }
        return {
          configured: true,
          ok: false,
          httpStatus: null,
          vendor: null,
          skippedDuplicate: true,
          canRetry: true,
        };
      }

      await sleep(PEER_DOWNLOAD_POLL_MS);
    }

    const last = await this.snapshotDownloadOutcome(params.applicationId, params.customerId);
    if (last) return last;
    const cached = await this.findSuccessfulAadhaarDownload(params.leadId);
    if (cached) {
      return this.completeFromVendorPayload({
        ...params,
        vendor: cached.vendor,
        httpStatus: cached.httpStatus,
        vendorKind: cached.vendorKind ?? params.vendorKind,
      });
    }
    return {
      configured: true,
      ok: false,
      httpStatus: null,
      vendor: null,
      skippedDuplicate: true,
      canRetry: true,
    };
  }

  private async findSuccessfulAadhaarDownload(leadId: bigint): Promise<{
    vendor: unknown;
    httpStatus: number;
    vendorKind: 'surepass' | 'tenacio' | null;
  } | null> {
    const rows = await this.prisma.client.vendorApiLog.findMany({
      where: {
        leadId,
        httpStatus: 200,
        serviceName: { in: [...AADHAAR_DOWNLOAD_SERVICE_NAMES] },
      },
      orderBy: { respondedAt: 'desc' },
      take: 8,
      select: { responsePayload: true, httpStatus: true, providerName: true },
    });

    for (const row of rows) {
      const vendor = unwrapVendorAuditPayload(row.responsePayload);
      if (!isTenacioVendorBusinessSuccess(vendor)) continue;
      const provider = (row.providerName ?? '').trim().toLowerCase();
      return {
        vendor,
        httpStatus: row.httpStatus ?? 200,
        vendorKind: provider.includes('surepass') ? 'surepass' : 'tenacio',
      };
    }
    return null;
  }

  private async downloadFromVendor(params: {
    sessionToken: string;
    vendorKind: 'surepass' | 'tenacio' | null | undefined;
    leadId: bigint;
    customerId: bigint;
    customerUuid: string;
    customerMobile?: string | null;
    applicationId: bigint;
    applicationUuid: string;
  }): Promise<DownloadAadhaarDigilockerResult> {
    let out = await this.digilockerFetch.downloadAadhaar(
      params.sessionToken,
      params.leadId,
      params.vendorKind,
    );
    let vendor = out.vendorBody ?? null;

    if (
      out.configured &&
      out.ok &&
      isDigilockerSessionNotReadyError(vendor)
    ) {
      this.logger.warn(
        `DigiLocker Aadhaar session not ready (leadId=${params.leadId.toString()}); retrying once.`,
      );
      await sleep(SESSION_NOT_READY_RETRY_DELAY_MS);
      out = await this.digilockerFetch.downloadAadhaar(
        params.sessionToken,
        params.leadId,
        params.vendorKind,
      );
      vendor = out.vendorBody ?? null;
    }

    if (!out.configured) {
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
      };
    }

    if (!out.ok || !isTenacioVendorBusinessSuccess(vendor)) {
      await this.persistVendorAttempt(
        { id: params.applicationId, customerId: params.customerId },
        out.httpStatus,
        vendor,
      );
      const escalation = await this.kycDigilockerDownloadFailure.recordFailureAndEscalate({
        leadId: params.leadId,
        applicationId: params.applicationId,
        customerMobile: params.customerMobile ?? undefined,
      });
      return {
        configured: true,
        ok: false,
        httpStatus: out.httpStatus,
        vendor,
        businessSuccess: out.ok ? false : undefined,
        ...escalation,
      };
    }

    return this.completeFromVendorPayload({
      ...params,
      vendor,
      httpStatus: out.httpStatus,
      vendorKind: out.vendorKind ?? params.vendorKind,
    });
  }

  private async completeFromVendorPayload(params: {
    sessionToken: string;
    vendorKind: 'surepass' | 'tenacio' | null | undefined;
    leadId: bigint;
    customerId: bigint;
    customerUuid: string;
    customerMobile?: string | null;
    applicationId: bigint;
    applicationUuid: string;
    vendor: unknown;
    httpStatus: number | null;
  }): Promise<DownloadAadhaarDigilockerResult> {
    const vendor = params.vendor;
    const already = await this.snapshotDownloadOutcome(params.applicationId, params.customerId);
    if (already) return already;

    const leadProfile = await this.prisma.client.leadDetail.findUnique({
      where: { leadId: params.leadId },
      select: { fullName: true, dateOfBirth: true },
    });

    const identityMatch = compareAadhaarToLeadProfile({
      leadFullName: leadProfile?.fullName ?? null,
      leadDateOfBirth: leadProfile?.dateOfBirth ?? null,
      vendor,
    });

    if (!identityMatch.matched) {
      const photoRel = await this.persistAadhaarPhotoIfPresent({
        vendor,
        customerUuid: params.customerUuid,
        applicationUuid: params.applicationUuid,
      });
      await this.applications.updateDigilockerAadhaarArtifacts({
        applicationId: params.applicationId,
        customerId: params.customerId,
        digilockerAadhaarFormJson: buildDigilockerIdentityMismatchJson({
          httpStatus: params.httpStatus,
          vendor,
          photoRelativePath: photoRel,
          reason: identityMatch.reason,
          message: identityMatch.message,
        }) as Prisma.InputJsonValue,
        aadhaarPhotoRelativePath: photoRel,
      });
      await this.kycIdentityRejection.rejectForAadhaarProfileMismatch({
        leadId: params.leadId,
        applicationId: params.applicationId,
        customerMobile: params.customerMobile ?? undefined,
        statusNote: identityMatch.message,
      });
      await this.digilockerSession.clear(params.applicationUuid);
      this.logger.warn(
        `Aadhaar identity mismatch (leadId=${params.leadId.toString()}, reason=${identityMatch.reason}): ${identityMatch.message}`,
      );
      return {
        configured: true,
        ok: false,
        httpStatus: params.httpStatus,
        vendor,
        businessSuccess: true,
        persisted: true,
        identityMismatch: true,
        identityMismatchMessage: identityMatch.message,
      };
    }

    let panCardNumber: string | null = null;
    let panFetched = false;
    if (params.vendorKind === 'surepass') {
      try {
        const panOut = await this.digilockerFetch.downloadPan(params.sessionToken, params.leadId);
        if (panOut.ok && panOut.panFields?.panNumber) {
          panCardNumber = panOut.panFields.panNumber;
          panFetched = true;
        } else {
          this.logger.warn(
            `Surepass DigiLocker PAN download did not return a PAN (leadId=${params.leadId.toString()}, http=${panOut.httpStatus ?? 'n/a'}).`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Surepass DigiLocker PAN download failed (leadId=${params.leadId.toString()}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    let persisted = false;
    try {
      const photoRel = await this.persistAadhaarPhotoIfPresent({
        vendor,
        customerUuid: params.customerUuid,
        applicationUuid: params.applicationUuid,
      });

      const formJson = buildDigilockerAadhaarFormJson(vendor, photoRel) ?? { _note: 'digilocker_vendor_unparsed' };
      await this.applications.updateDigilockerAadhaarArtifacts({
        applicationId: params.applicationId,
        customerId: params.customerId,
        digilockerAadhaarFormJson: formJson as Prisma.InputJsonValue,
        aadhaarPhotoRelativePath: photoRel,
      });
      persisted = true;
      await this.digilockerSession.clear(params.applicationUuid);
      await this.kycCompletion.completeFromDigilockerAadhaar({
        applicationId: params.applicationId,
        customerId: params.customerId,
        digilockerAadhaarFormJson: formJson as Prisma.JsonValue,
        aadhaarPhotoRelativePath: photoRel,
        verifiedAt: new Date(),
        panCardNumber,
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist DigiLocker Aadhaar artifacts: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    return {
      configured: true,
      ok: true,
      httpStatus: params.httpStatus,
      vendor,
      businessSuccess: true,
      persisted,
      panFetched,
      panCardNumber,
    };
  }

  private async persistAadhaarPhotoIfPresent(params: {
    vendor: unknown;
    customerUuid: string;
    applicationUuid: string;
  }): Promise<string | null> {
    const photoRaw = extractAadhaarPhotoString(params.vendor);
    if (!photoRaw) return null;
    const decoded = decodeAadhaarPhoto(photoRaw);
    if (!decoded?.buffer.length) return null;
    const photoRel = this.kycFiles.aadhaarPhotoRelativePath(
      params.customerUuid,
      params.applicationUuid,
      decoded.ext,
    );
    await this.kycFiles.writeBytes(photoRel, decoded.buffer);
    return photoRel;
  }

  private async persistVendorAttempt(
    application: { id: bigint; customerId: bigint },
    httpStatus: number | null,
    vendor: unknown,
  ): Promise<void> {
    const customerKyc = await this.prisma.client.customerKyc.findFirst({
      where: { customerId: application.customerId },
      orderBy: { createdAt: 'desc' },
      select: { aadhaarData: true },
    });
    if (isDigilockerAadhaarCaptureComplete(customerKyc?.aadhaarData)) {
      return;
    }
    try {
      await this.applications.updateDigilockerAadhaarArtifacts({
        applicationId: application.id,
        customerId: application.customerId,
        digilockerAadhaarFormJson: buildDigilockerVendorAttemptJson({
          httpStatus,
          vendor,
        }) as Prisma.InputJsonValue,
        aadhaarPhotoRelativePath: null,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist DigiLocker vendor attempt (applicationId=${application.id.toString()}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
