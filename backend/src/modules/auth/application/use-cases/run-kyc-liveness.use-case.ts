import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { isApplicationFaceStepComplete } from '../../../../common/kyc/application-kyc-guard.util';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { LivenessVendorService } from '../../../../common/vendor/liveness-vendor.service';
import {
  extractFaceMatchPassed,
  extractFaceMatchScore,
  extractLivenessFaceOccluded,
  extractLivenessIsLive,
  extractLivenessMultipleFacesDetected,
  extractLivenessScore,
  isTenacioVendorBusinessSuccess,
  pickTenacioVendorErrorMessage,
} from '../../../../common/kyc/aadhaar-vendor-parse.util';
import { KycFaceMatchService } from '../../../../common/kyc/kyc-face-match.service';
import {
  toPersistedFaceMatchInspection,
} from '../../../../common/kyc/kyc-face-match-inspection-persist.util';
import { emptyFaceMatchInspection } from '../../../../common/kyc/kyc-face-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../../../../common/kyc/kyc-selfie-face-validation.service';
import { toPersistedSelfieFaceInspection } from '../../../../common/kyc/kyc-selfie-face-inspection-persist.util';
import {
  isKycVendorTechnicalFailure,
  KYC_SELFIE_GENERIC_RETRY_MESSAGE,
} from '../../../../common/kyc/kyc-liveness-customer-message.util';
import { resolveKycLivenessSelfiePublicUrl } from '../../../../common/kyc/kyc-liveness-selfie-url.util';
import {
  buildKycPipelineStepLog,
  describeLocalKycCheckFailure,
  formatKycPipelineStepForLogger,
  type KycLivenessPipelineStepLog,
  type LocalKycCheckOperation,
  type LocalKycCheckPhase,
} from '../../../../common/kyc/kyc-liveness-pipeline-log.util';
import { resolveKycPublicObjectUrl } from '../../../../common/kyc/kyc-public-object-url.util';
import { KycTenacioVendorService } from '../../../../common/vendor/kyc-tenacio-vendor.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import {
  isKycLivenessCheckPaused,
  isKycLivenessOutboundSkipped,
} from '../../../../common/kyc/kyc-liveness-env.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { KYC_VENDOR_TECHNICAL_ISSUE_CUSTOMER_MESSAGE } from '../../../../common/constants/kyc.constants';
import { VendorInternalErrorService } from '../../../../common/vendor/vendor-internal-error.service';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

export type RunKycLivenessResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  livenessPassed: boolean;
  /** From Tenacio `error.message` when the vendor rejects the request (HTTP may still be 200 via proxy). */
  vendorErrorMessage?: string;
  /** When `application.kyc_status` was already completed (no vendor call). */
  alreadyCompleted?: boolean;
  /** On-server selfie face validation (MoneyCash liveness module). */
  faceValidationPassed?: boolean;
  faceValidationMessage?: string;
  /** On-server Aadhaar vs selfie face match (MoneyCash face-api module). */
  faceMatchPassed?: boolean;
  faceMatchMessage?: string;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
  /** Generic customer copy (never raw vendor errors). */
  customerMessage?: string;
  /** Vendor auth/config failure — lead escalated to INTERNAL_ERROR; show thank-you. */
  internalError?: boolean;
};

type LocalKycChecksPayload = {
  selfieFaceValidation: ReturnType<typeof toPersistedSelfieFaceInspection>;
  faceMatch: ReturnType<typeof toPersistedFaceMatchInspection>;
  pipelineSteps: KycLivenessPipelineStepLog[];
  localChecksCompletedAt: string;
};

type VendorChecksPayload = {
  tenacioLiveness?: {
    configured: boolean;
    passed: boolean;
    livenessScore: number | null;
    isLive: boolean | null;
    skipReason?: string;
    vendor: unknown;
    httpStatus: number | null;
  };
  tenacioFaceMatch?: {
    configured: boolean;
    passed: boolean;
    matchScore: number | null;
    matchPassed: boolean | null;
    skipReason?: string;
    vendor: unknown;
    httpStatus: number | null;
  };
};

@Injectable()
export class RunKycLivenessUseCase {
  private readonly logger = new Logger(RunKycLivenessUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly liveness: LivenessVendorService,
    private readonly kycFiles: KycFilesService,
    private readonly selfieFaceValidation: KycSelfieFaceValidationService,
    private readonly faceMatch: KycFaceMatchService,
    private readonly kycTenacio: KycTenacioVendorService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsRepository,
    private readonly kycCompletion: KycCompletionService,
    private readonly internalError: VendorInternalErrorService,
  ) {}

  async execute(req: Request): Promise<RunKycLivenessResult> {
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

    const application = await fetchLatestApplicationKycSnapshot(this.prisma.client, {
      leadId: lead.id,
      customerId: customer.id,
    });

    if (!application) {
      throw new BadRequestException('No application found for this lead.');
    }

    if (isApplicationFaceStepComplete(application)) {
      return {
        configured: true,
        ok: true,
        httpStatus: 200,
        vendor: null,
        livenessPassed: true,
        alreadyCompleted: true,
      };
    }

    if (!application.selfieRelativePath?.trim()) {
      throw new BadRequestException('Upload a selfie before running liveness.');
    }

    const selfieRelativePath = application.selfieRelativePath.trim();
    const applicationFresh = await this.prisma.client.application.findUnique({
      where: { id: application.id },
      select: { updatedAt: true },
    });
    const photoVersion = applicationFresh?.updatedAt?.getTime() ?? Date.now();

    const localChecks = await this.runMoneyCashLocalKycChecks({
      applicationId: application.id,
      selfieRelativePath,
      aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
    });

    if (!localChecks.ok) {
      if (localChecks.localChecksPayload) {
        await this.persistKycPipelineResult({
          applicationId: application.id,
          localChecksPayload: localChecks.localChecksPayload,
          passed: false,
        });
      }
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: localChecks.localChecksPayload ?? null,
        livenessPassed: false,
        faceValidationPassed: localChecks.faceValidationPassed,
        faceValidationMessage: localChecks.faceValidationMessage ?? KYC_SELFIE_GENERIC_RETRY_MESSAGE,
        faceMatchPassed: localChecks.faceMatchPassed,
        faceMatchMessage: localChecks.faceMatchMessage,
        suggestRetrySelfie: localChecks.suggestRetrySelfie,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        customerMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
      };
    }

    let localChecksPayload = localChecks.localChecksPayload!;

    await this.persistKycPipelineResult({
      applicationId: application.id,
      localChecksPayload,
      passed: false,
    });

    if (isKycLivenessOutboundSkipped()) {
      const checkedAt = new Date();
      const localVendor = {
        ...(isKycLivenessCheckPaused()
          ? { paused: true, localFaceCheck: true }
          : { outboundSkipped: true, localFaceCheck: true }),
        localChecks: localChecksPayload,
      };

      await this.applications.updateLivenessResult({
        applicationId: application.id,
        livenessVendorJson: localVendor as Prisma.InputJsonValue,
        passed: true,
        checkedAt,
        done: true,
        doneAt: checkedAt,
      });

      await this.kycCompletion.completeFromDigilockerAadhaar({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: (application.digilockerAadhaarFormJson ?? null) as Prisma.JsonValue,
        aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
        verifiedAt: checkedAt,
      });

      return {
        configured: true,
        ok: true,
        httpStatus: null,
        vendor: localVendor,
        livenessPassed: true,
        faceValidationPassed: true,
        faceMatchPassed: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
      };
    }

    const selfieUrlResult = await resolveKycLivenessSelfiePublicUrl(this.kycFiles, {
      applicationUuid: application.uuid,
      selfieRelativePath: application.selfieRelativePath.trim(),
      photoVersion,
    });
    if (!selfieUrlResult.ok) {
      await this.persistKycPipelineResult({
        applicationId: application.id,
        localChecksPayload,
        passed: false,
      });
      return {
        configured: false,
        skipReason: selfieUrlResult.error,
        ok: false,
        httpStatus: null,
        vendor: mergeVendorPayload(localChecksPayload, {}),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: true,
        vendorErrorMessage: selfieUrlResult.error,
      };
    }

    const aadhaarRelativePath = application.aadhaarPhotoRelativePath?.trim();
    if (!aadhaarRelativePath) {
      await this.persistKycPipelineResult({
        applicationId: application.id,
        localChecksPayload,
        passed: false,
      });
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: mergeVendorPayload(localChecksPayload, {}),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: false,
        faceMatchMessage: 'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
        vendorErrorMessage: 'Aadhaar reference photo is missing.',
      };
    }

    const aadhaarUrlResult = await resolveKycPublicObjectUrl(this.kycFiles, aadhaarRelativePath);
    if (!aadhaarUrlResult.ok) {
      await this.persistKycPipelineResult({
        applicationId: application.id,
        localChecksPayload,
        passed: false,
      });
      return {
        configured: false,
        skipReason: aadhaarUrlResult.error,
        ok: false,
        httpStatus: null,
        vendor: mergeVendorPayload(localChecksPayload, {}),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: false,
        vendorErrorMessage: aadhaarUrlResult.error,
      };
    }

    let vendorChecks: VendorChecksPayload = {};

    const livenessGate = await this.runTenacioLivenessCheck({
      leadId: lead.id,
      selfieUrl: selfieUrlResult.url,
      selfieRelativePath: application.selfieRelativePath.trim(),
      pipelineSteps: localChecksPayload.pipelineSteps,
    });
    vendorChecks = { tenacioLiveness: livenessGate.payload };

    if (!livenessGate.ok) {
      const vendorBody = livenessGate.payload?.vendor;
      if (
        isKycVendorTechnicalFailure({
          message: livenessGate.message,
          httpStatus: livenessGate.httpStatus,
          vendor: vendorBody,
        })
      ) {
        return this.returnVendorTechnicalIssue({
          applicationId: application.id,
          leadId: lead.id,
          providerName: 'Tenacio',
          serviceName: 'liveness',
          httpStatus: livenessGate.httpStatus,
          localChecksPayload,
          vendorChecks,
          bestComputedConfidence: localChecks.bestComputedConfidence,
        });
      }
      await this.persistKycPipelineResult({
        applicationId: application.id,
        localChecksPayload,
        vendorChecks,
        passed: false,
      });
      return {
        configured: livenessGate.configured,
        skipReason: livenessGate.skipReason,
        ok: false,
        httpStatus: livenessGate.httpStatus,
        vendor: mergeVendorPayload(localChecksPayload, vendorChecks),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: true,
        suggestRetrySelfie: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        customerMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
        faceValidationMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
      };
    }

    const faceMatchGate = await this.runTenacioFaceMatchCheck({
      leadId: lead.id,
      aadhaarUrl: aadhaarUrlResult.url,
      selfieUrl: selfieUrlResult.url,
      aadhaarRelativePath,
      selfieRelativePath: application.selfieRelativePath.trim(),
      pipelineSteps: localChecksPayload.pipelineSteps,
    });
    vendorChecks = { ...vendorChecks, tenacioFaceMatch: faceMatchGate.payload };

    if (!faceMatchGate.ok) {
      const vendorBody = faceMatchGate.payload?.vendor;
      if (
        isKycVendorTechnicalFailure({
          message: faceMatchGate.message,
          httpStatus: faceMatchGate.httpStatus,
          vendor: vendorBody,
        })
      ) {
        return this.returnVendorTechnicalIssue({
          applicationId: application.id,
          leadId: lead.id,
          providerName: 'Tenacio',
          serviceName: 'face-match',
          httpStatus: faceMatchGate.httpStatus,
          localChecksPayload,
          vendorChecks,
          bestComputedConfidence: localChecks.bestComputedConfidence,
        });
      }
      await this.persistKycPipelineResult({
        applicationId: application.id,
        localChecksPayload,
        vendorChecks,
        passed: false,
      });
      return {
        configured: faceMatchGate.configured,
        skipReason: faceMatchGate.skipReason,
        ok: false,
        httpStatus: faceMatchGate.httpStatus,
        vendor: mergeVendorPayload(localChecksPayload, vendorChecks),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: false,
        faceMatchMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
        suggestRetrySelfie: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        customerMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
      };
    }

    const businessOk = livenessGate.passed && faceMatchGate.passed;
    const checkedAt = new Date();

    await this.persistKycPipelineResult({
      applicationId: application.id,
      localChecksPayload,
      vendorChecks,
      passed: businessOk,
      done: businessOk,
      checkedAt,
    });

    if (businessOk) {
      await this.kycCompletion.completeFromDigilockerAadhaar({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: (application.digilockerAadhaarFormJson ?? null) as Prisma.JsonValue,
        aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
        verifiedAt: checkedAt,
      });
      const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();
      await this.internalError.recoverLeadIfVendorFailuresCleared(lead.id, providerName);
    }

    if (!businessOk) {
      const vendorBody = faceMatchGate.payload?.vendor ?? livenessGate.payload?.vendor;
      const vendorMessage = livenessGate.message ?? faceMatchGate.message;
      if (
        isKycVendorTechnicalFailure({
          message: vendorMessage,
          httpStatus: livenessGate.httpStatus ?? faceMatchGate.httpStatus,
          vendor: vendorBody,
        })
      ) {
        return this.returnVendorTechnicalIssue({
          applicationId: application.id,
          leadId: lead.id,
          providerName: 'Tenacio',
          serviceName: 'liveness',
          httpStatus: livenessGate.httpStatus ?? faceMatchGate.httpStatus,
          localChecksPayload,
          vendorChecks,
          bestComputedConfidence: localChecks.bestComputedConfidence,
        });
      }
    }

    return {
      configured: true,
      ok: businessOk,
      httpStatus: livenessGate.httpStatus,
      vendor: mergeVendorPayload(localChecksPayload, vendorChecks),
      livenessPassed: businessOk,
      faceValidationPassed: true,
      faceMatchPassed: faceMatchGate.passed,
      bestComputedConfidence: localChecks.bestComputedConfidence,
      ...(businessOk
        ? {}
        : {
            suggestRetrySelfie: true,
            customerMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
            faceMatchMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
          }),
    };
  }

  private recordPipelineStep(
    pipelineSteps: KycLivenessPipelineStepLog[],
    entry: KycLivenessPipelineStepLog,
  ): void {
    pipelineSteps.push(entry);
    this.logger.log(formatKycPipelineStepForLogger(entry));
  }

  private async persistKycPipelineResult(params: {
    applicationId: bigint;
    localChecksPayload: LocalKycChecksPayload;
    vendorChecks?: VendorChecksPayload;
    passed: boolean;
    done?: boolean;
    checkedAt?: Date;
  }): Promise<void> {
    const checkedAt = params.checkedAt ?? new Date();
    const done = params.done ?? false;
    try {
      await this.applications.updateLivenessResult({
        applicationId: params.applicationId,
        livenessVendorJson: mergeVendorPayload(
          params.localChecksPayload,
          params.vendorChecks ?? {},
        ) as Prisma.InputJsonValue,
        passed: params.passed,
        checkedAt,
        done,
        doneAt: done ? checkedAt : null,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist KYC pipeline result (applicationId=${params.applicationId.toString()}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async returnVendorTechnicalIssue(params: {
    applicationId: bigint;
    leadId: bigint;
    providerName: string;
    serviceName: string;
    httpStatus: number | null;
    localChecksPayload: LocalKycChecksPayload;
    vendorChecks: VendorChecksPayload;
    bestComputedConfidence: number | null;
  }): Promise<RunKycLivenessResult> {
    await this.persistKycPipelineResult({
      applicationId: params.applicationId,
      localChecksPayload: params.localChecksPayload,
      vendorChecks: params.vendorChecks,
      passed: false,
    });

    await this.internalError.handleVendorTechnicalIssue({
      leadId: params.leadId,
      providerName: params.providerName,
      serviceName: params.serviceName,
    });

    return {
      configured: true,
      ok: false,
      httpStatus: params.httpStatus,
      vendor: mergeVendorPayload(params.localChecksPayload, params.vendorChecks),
      livenessPassed: false,
      internalError: true,
      customerMessage: KYC_VENDOR_TECHNICAL_ISSUE_CUSTOMER_MESSAGE,
      faceValidationPassed: true,
      faceMatchPassed: true,
      suggestRetrySelfie: false,
      bestComputedConfidence: params.bestComputedConfidence,
    };
  }

  private async runTenacioLivenessCheck(params: {
    leadId: bigint;
    selfieUrl: string;
    selfieRelativePath: string;
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): Promise<{
    ok: boolean;
    configured: boolean;
    passed: boolean;
    skipReason?: string;
    httpStatus: number | null;
    message?: string;
    payload: NonNullable<VendorChecksPayload['tenacioLiveness']>;
  }> {
    const livenessInput = { input: { consent: true, url: params.selfieUrl } };

    const out = await this.liveness.postLivenessCheck(
      livenessInput,
      params.leadId,
      params.selfieRelativePath,
    );

    const vendor = out.vendorBody ?? null;
    const vendorStatusOk = out.ok && isTenacioVendorBusinessSuccess(vendor);

    if (!out.configured) {
      const payload: NonNullable<VendorChecksPayload['tenacioLiveness']> = {
        configured: false,
        passed: false,
        livenessScore: extractLivenessScore(vendor),
        isLive: extractLivenessIsLive(vendor),
        skipReason: out.skipReason,
        vendor,
        httpStatus: out.httpStatus,
      };
      this.recordPipelineStep(
        params.pipelineSteps,
        buildKycPipelineStepLog('3-tenacio-liveness', {
          ok: false,
          request: livenessInput,
          response: vendor,
          httpStatus: out.httpStatus,
          skipReason: out.skipReason,
        }),
      );
      return {
        ok: false,
        configured: false,
        passed: false,
        skipReason: out.skipReason,
        httpStatus: out.httpStatus,
        message: out.skipReason,
        payload,
      };
    }

    const minScore = await this.settings.loadMinLivenessApiScore();
    const livenessScore = extractLivenessScore(vendor);
    const scoreOk = livenessScore === null || livenessScore >= minScore;
    const isLive = extractLivenessIsLive(vendor);
    const isLiveOk = isLive === null || isLive === true;
    const multipleFaces = extractLivenessMultipleFacesDetected(vendor);
    const multipleFacesOk = multipleFaces === null || multipleFaces === false;
    const faceOccluded = extractLivenessFaceOccluded(vendor);
    const faceOccludedOk = faceOccluded === null || faceOccluded === false;
    const passed = vendorStatusOk && scoreOk && isLiveOk && multipleFacesOk && faceOccludedOk;

    const payload: NonNullable<VendorChecksPayload['tenacioLiveness']> = {
      configured: true,
      passed,
      livenessScore,
      isLive,
      vendor,
      httpStatus: out.httpStatus,
    };

    this.recordPipelineStep(
      params.pipelineSteps,
      buildKycPipelineStepLog('3-tenacio-liveness', {
        ok: passed,
        request: livenessInput,
        response: {
          vendor,
          livenessScore,
          isLive,
          scoreOk,
          isLiveOk,
          multipleFacesOk,
          faceOccludedOk,
          minScore,
        },
        httpStatus: out.httpStatus,
      }),
    );

    if (!passed) {
      const message =
        pickTenacioVendorErrorMessage(vendor) ?? 'Liveness check did not pass. Please try again with a live selfie.';
      return {
        ok: false,
        configured: true,
        passed: false,
        httpStatus: out.httpStatus,
        message,
        payload,
      };
    }

    return {
      ok: true,
      configured: true,
      passed: true,
      httpStatus: out.httpStatus,
      payload,
    };
  }

  private async runTenacioFaceMatchCheck(params: {
    leadId: bigint;
    aadhaarUrl: string;
    selfieUrl: string;
    aadhaarRelativePath: string;
    selfieRelativePath: string;
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): Promise<{
    ok: boolean;
    configured: boolean;
    passed: boolean;
    skipReason?: string;
    httpStatus: number | null;
    message?: string;
    payload: NonNullable<VendorChecksPayload['tenacioFaceMatch']>;
  }> {
    const faceMatchConfigured = this.kycTenacio.isFaceMatchConfigured();

    if (!faceMatchConfigured) {
      const payload: NonNullable<VendorChecksPayload['tenacioFaceMatch']> = {
        configured: false,
        passed: true,
        matchScore: null,
        matchPassed: null,
        skipReason: 'Tenacio face match not configured — local ML result used.',
        vendor: null,
        httpStatus: null,
      };
      this.recordPipelineStep(
        params.pipelineSteps,
        buildKycPipelineStepLog('4-tenacio-face-match', {
          ok: true,
          request: null,
          response: payload,
          skipReason: payload.skipReason,
        }),
      );
      return {
        ok: true,
        configured: false,
        passed: true,
        httpStatus: null,
        payload,
      };
    }

    const faceMatchInput = {
      input: {
        consent: true,
        url1: params.aadhaarUrl,
        url2: params.selfieUrl,
      },
    };

    const out = await this.kycTenacio.postFaceMatch(faceMatchInput, params.leadId);
    const vendor = out.vendorBody ?? null;
    const matchScore = extractFaceMatchScore(vendor);
    const matchPassed = extractFaceMatchPassed(vendor);

    if (!out.configured) {
      const payload: NonNullable<VendorChecksPayload['tenacioFaceMatch']> = {
        configured: false,
        passed: false,
        matchScore,
        matchPassed,
        skipReason: out.skipReason,
        vendor,
        httpStatus: out.httpStatus,
      };
      this.recordPipelineStep(
        params.pipelineSteps,
        buildKycPipelineStepLog('4-tenacio-face-match', {
          ok: false,
          request: faceMatchInput,
          response: vendor,
          httpStatus: out.httpStatus,
          skipReason: out.skipReason,
        }),
      );
      return {
        ok: false,
        configured: false,
        passed: false,
        skipReason: out.skipReason,
        httpStatus: out.httpStatus,
        message: out.skipReason,
        payload,
      };
    }

    const vendorStatusOk = out.ok && isTenacioVendorBusinessSuccess(vendor);
    const passed = vendorStatusOk && matchPassed !== false;
    const payload: NonNullable<VendorChecksPayload['tenacioFaceMatch']> = {
      configured: true,
      passed,
      matchScore,
      matchPassed,
      vendor,
      httpStatus: out.httpStatus,
    };

    this.recordPipelineStep(
      params.pipelineSteps,
      buildKycPipelineStepLog('4-tenacio-face-match', {
        ok: passed,
        request: faceMatchInput,
        response: { vendor, matchScore, matchPassed },
        httpStatus: out.httpStatus,
      }),
    );

    if (!passed) {
      const message =
        pickTenacioVendorErrorMessage(vendor) ??
        'Your selfie does not match your Aadhaar photo.';
      return {
        ok: false,
        configured: true,
        passed: false,
        httpStatus: out.httpStatus,
        message,
        payload,
      };
    }

    return {
      ok: true,
      configured: true,
      passed: true,
      httpStatus: out.httpStatus,
      payload,
    };
  }

  /**
   * MoneyCash on-server KYC gates (in order):
   * 2. Internal liveness (selfie face validation)
   * 2.1 Internal face match (Aadhaar vs selfie)
   * Then step 3 Tenacio liveness and step 4 Tenacio face match when outbound is enabled.
   */
  private async runMoneyCashLocalKycChecks(params: {
    applicationId: bigint;
    selfieRelativePath: string;
    aadhaarPhotoRelativePath: string | null;
  }): Promise<{
    ok: boolean;
    faceValidationPassed?: boolean;
    faceValidationMessage?: string;
    faceMatchPassed?: boolean;
    faceMatchMessage?: string;
    suggestRetrySelfie?: boolean;
    bestComputedConfidence: number | null;
    localChecksPayload?: LocalKycChecksPayload;
  }> {
    const pipelineSteps: KycLivenessPipelineStepLog[] = [];
    let localCheckPhase: LocalKycCheckPhase = '2-internal-liveness';
    let localCheckOperation: LocalKycCheckOperation = 'read-storage';
    let activeRelativePath = params.selfieRelativePath;
    let persistedSelfieAfterValidation: ReturnType<typeof toPersistedSelfieFaceInspection> | null =
      null;
    let bestComputedConfidenceAfterValidation: number | null = null;

    try {
      localCheckPhase = '2-internal-liveness';
      localCheckOperation = 'read-storage';
      activeRelativePath = params.selfieRelativePath;
      const selfieBuffer = await this.kycFiles.readBytes(params.selfieRelativePath);

      // Step 2 — internal liveness (selfie face validation).
      localCheckOperation = 'validate';
      const selfieInspection = await this.selfieFaceValidation.inspectJpegBuffer(selfieBuffer);
      const persistedSelfie = toPersistedSelfieFaceInspection(selfieInspection);
      persistedSelfieAfterValidation = persistedSelfie;
      bestComputedConfidenceAfterValidation = selfieInspection.bestComputedConfidence;
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog('2-internal-liveness', {
          ok: selfieInspection.ok,
          request: { selfieRelativePath: params.selfieRelativePath },
          response: persistedSelfie,
        }),
      );

      const checkedAt = new Date();
      await this.applications.updateSelfieFaceValidation({
        applicationId: params.applicationId,
        selfieFaceValidationJson: persistedSelfie,
        passed: selfieInspection.ok,
        checkedAt,
      });

      if (!selfieInspection.ok) {
        const reason = selfieInspection.reason ?? 'Selfie face validation failed.';
        return {
          ok: false,
          faceValidationPassed: false,
          faceValidationMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
          suggestRetrySelfie: true,
          bestComputedConfidence: selfieInspection.bestComputedConfidence,
          localChecksPayload: {
            selfieFaceValidation: persistedSelfie,
            faceMatch: toPersistedFaceMatchInspection(
              emptyFaceMatchInspection('Skipped — internal liveness failed.'),
            ),
            pipelineSteps,
            localChecksCompletedAt: new Date().toISOString(),
          },
        };
      }

      // Step 2.1 — internal face match (Aadhaar reference vs selfie).
      const aadhaarPath = params.aadhaarPhotoRelativePath?.trim();
      if (!aadhaarPath) {
        const faceMatchSkipped = toPersistedFaceMatchInspection(
          emptyFaceMatchInspection(
            'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
          ),
        );
        this.recordPipelineStep(
          pipelineSteps,
          buildKycPipelineStepLog('2.1-internal-face-match', {
            ok: false,
            request: { aadhaarRelativePath: null, selfieRelativePath: params.selfieRelativePath },
            response: faceMatchSkipped,
            skipReason: 'Aadhaar reference photo missing',
          }),
        );
        return {
          ok: false,
          faceValidationPassed: true,
          faceMatchPassed: false,
          faceMatchMessage: 'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
          bestComputedConfidence: selfieInspection.bestComputedConfidence,
          localChecksPayload: {
            selfieFaceValidation: persistedSelfie,
            faceMatch: faceMatchSkipped,
            pipelineSteps,
            localChecksCompletedAt: new Date().toISOString(),
          },
        };
      }

      localCheckPhase = '2.1-internal-face-match';
      localCheckOperation = 'read-storage';
      activeRelativePath = aadhaarPath;
      const aadhaarBuffer = await this.kycFiles.readBytes(aadhaarPath);
      localCheckOperation = 'compare';
      const faceMatchInspection = await this.faceMatch.compareJpegBuffers(aadhaarBuffer, selfieBuffer);
      const persistedFaceMatch = toPersistedFaceMatchInspection(faceMatchInspection);
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog('2.1-internal-face-match', {
          ok: faceMatchInspection.matchPassed,
          request: {
            aadhaarRelativePath: aadhaarPath,
            selfieRelativePath: params.selfieRelativePath,
          },
          response: persistedFaceMatch,
        }),
      );

      if (!faceMatchInspection.matchPassed) {
        const reason = faceMatchInspection.reason ?? 'Your selfie does not match your Aadhaar photo.';
        return {
          ok: false,
          faceValidationPassed: true,
          faceMatchPassed: false,
          faceMatchMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE,
          suggestRetrySelfie: true,
          bestComputedConfidence: selfieInspection.bestComputedConfidence,
          localChecksPayload: {
            selfieFaceValidation: persistedSelfie,
            faceMatch: persistedFaceMatch,
            pipelineSteps,
            localChecksCompletedAt: new Date().toISOString(),
          },
        };
      }

      return {
        ok: true,
        bestComputedConfidence: selfieInspection.bestComputedConfidence,
        localChecksPayload: {
          selfieFaceValidation: persistedSelfie,
          faceMatch: persistedFaceMatch,
          pipelineSteps,
          localChecksCompletedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      const failureDetail = describeLocalKycCheckFailure(
        localCheckPhase,
        localCheckOperation,
        activeRelativePath,
        err,
      );
      this.logger.warn(`MoneyCash local KYC checks failed: ${failureDetail}`);
      const pipelineRequest =
        localCheckPhase === '2.1-internal-face-match'
          ? {
              aadhaarRelativePath:
                localCheckOperation === 'read-storage' ? activeRelativePath : params.aadhaarPhotoRelativePath?.trim(),
              selfieRelativePath: params.selfieRelativePath,
              operation: localCheckOperation,
            }
          : {
              selfieRelativePath: activeRelativePath,
              operation: localCheckOperation,
            };
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog(localCheckPhase, {
          ok: false,
          request: pipelineRequest,
          response: { error: failureDetail },
        }),
      );

      const selfieAlreadyValidated = persistedSelfieAfterValidation !== null;
      const aadhaarStorageMissing =
        localCheckPhase === '2.1-internal-face-match' && localCheckOperation === 'read-storage';

      return {
        ok: false,
        faceValidationPassed: selfieAlreadyValidated ? true : false,
        faceValidationMessage: selfieAlreadyValidated
          ? undefined
          : KYC_SELFIE_GENERIC_RETRY_MESSAGE,
        faceMatchPassed: selfieAlreadyValidated ? false : undefined,
        faceMatchMessage: aadhaarStorageMissing
          ? 'Aadhaar reference photo is not available in storage. Complete DigiLocker Aadhaar download again.'
          : selfieAlreadyValidated
            ? KYC_SELFIE_GENERIC_RETRY_MESSAGE
            : undefined,
        suggestRetrySelfie: !aadhaarStorageMissing,
        bestComputedConfidence: bestComputedConfidenceAfterValidation,
        localChecksPayload: {
          selfieFaceValidation:
            persistedSelfieAfterValidation ??
            toPersistedSelfieFaceInspection({
              ok: false,
              reason: failureDetail,
              productionValidationDisabled: false,
              imageWidth: 0,
              imageHeight: 0,
              minConfidenceRequired: 0,
              minComputedConfidenceRequired: 0,
              bestComputedConfidence: null,
              confidenceBreakdown: null,
              minFaceAreaRatio: 0,
              laplacianVariance: null,
              minLaplacianVarianceRequired: 0,
              blurPassed: null,
              rawDetectionCount: 0,
              qualifyingDetectionCount: 0,
              detections: [],
            }),
          faceMatch: toPersistedFaceMatchInspection(
            emptyFaceMatchInspection(
              selfieAlreadyValidated
                ? `Skipped — ${failureDetail}`
                : 'Skipped — internal liveness failed before face match.',
            ),
          ),
          pipelineSteps,
          localChecksCompletedAt: new Date().toISOString(),
        },
      };
    }
  }
}

function mergeVendorPayload(
  localChecks: LocalKycChecksPayload,
  vendorChecks: VendorChecksPayload,
): Prisma.InputJsonObject {
  return {
    localChecks,
    ...vendorChecks,
    pipelineSteps: localChecks.pipelineSteps,
  } as Prisma.InputJsonObject;
}
