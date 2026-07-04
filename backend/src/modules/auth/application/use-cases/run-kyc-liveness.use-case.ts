import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { isApplicationFaceStepComplete } from '../../../../common/kyc/application-kyc-guard.util';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { LivenessVendorService } from '../../../../common/vendor/liveness-vendor.service';
import {
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
import { resolveKycLivenessSelfiePublicUrl } from '../../../../common/kyc/kyc-liveness-selfie-url.util';
import {
  buildKycPipelineStepLog,
  describeLocalKycCheckFailure,
  formatKycPipelineStepForLogger,
  type KycLivenessPipelineStepLog,
  type LocalKycCheckOperation,
  type LocalKycCheckPhase,
} from '../../../../common/kyc/kyc-liveness-pipeline-log.util';
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
  /** Any pipeline failure — lead escalated to INTERNAL_ERROR; show thank-you. */
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

    // Step 2 — MoneyCash liveness (selfie face validation).
    const moneyCashLiveness = await this.runMoneyCashLivenessCheck({
      applicationId: application.id,
      selfieRelativePath,
    });
    if (!moneyCashLiveness.ok || !moneyCashLiveness.localChecksPayload) {
      return this.returnKycPipelineFailed({
        applicationId: application.id,
        leadId: lead.id,
        providerName: 'MoneyCash',
        serviceName: 'liveness',
        localChecksPayload: moneyCashLiveness.localChecksPayload,
        faceValidationPassed: false,
        bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
      });
    }

    let localChecksPayload = moneyCashLiveness.localChecksPayload;
    let vendorChecks: VendorChecksPayload = {};
    let tenacioHttpStatus: number | null = null;

    // Step 3 — Tenacio liveness (skipped when outbound is disabled / paused).
    if (isKycLivenessOutboundSkipped()) {
      const skipReason = isKycLivenessCheckPaused()
        ? 'Tenacio liveness paused — MoneyCash checks only.'
        : 'Tenacio liveness outbound skipped — MoneyCash checks only.';
      const tenacioPayload: NonNullable<VendorChecksPayload['tenacioLiveness']> = {
        configured: false,
        passed: true,
        livenessScore: null,
        isLive: null,
        skipReason,
        vendor: null,
        httpStatus: null,
      };
      this.recordPipelineStep(
        localChecksPayload.pipelineSteps,
        buildKycPipelineStepLog('3-tenacio-liveness', {
          ok: true,
          request: null,
          response: tenacioPayload,
          skipReason,
        }),
      );
      vendorChecks = { tenacioLiveness: tenacioPayload };
    } else {
      const selfieUrlResult = await resolveKycLivenessSelfiePublicUrl(this.kycFiles, {
        applicationUuid: application.uuid,
        selfieRelativePath,
        photoVersion,
      });
      if (!selfieUrlResult.ok) {
        return this.returnKycPipelineFailed({
          applicationId: application.id,
          leadId: lead.id,
          providerName: 'Tenacio',
          serviceName: 'liveness',
          localChecksPayload,
          faceValidationPassed: true,
          bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
          configured: false,
          skipReason: selfieUrlResult.error,
          vendorErrorMessage: selfieUrlResult.error,
        });
      }

      const livenessGate = await this.runTenacioLivenessCheck({
        leadId: lead.id,
        selfieUrl: selfieUrlResult.url,
        selfieRelativePath,
        pipelineSteps: localChecksPayload.pipelineSteps,
      });
      vendorChecks = { tenacioLiveness: livenessGate.payload };
      tenacioHttpStatus = livenessGate.httpStatus;

      if (!livenessGate.ok || !livenessGate.passed) {
        return this.returnKycPipelineFailed({
          applicationId: application.id,
          leadId: lead.id,
          providerName: 'Tenacio',
          serviceName: 'liveness',
          httpStatus: livenessGate.httpStatus,
          localChecksPayload,
          vendorChecks,
          faceValidationPassed: true,
          bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
          configured: livenessGate.configured,
          skipReason: livenessGate.skipReason,
          vendorErrorMessage: livenessGate.message,
        });
      }
    }

    // Step 4 — MoneyCash face match (Aadhaar vs selfie).
    const moneyCashFaceMatch = await this.runMoneyCashFaceMatchCheck({
      applicationId: application.id,
      selfieRelativePath,
      aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
      pipelineSteps: localChecksPayload.pipelineSteps,
      selfieFaceValidation: localChecksPayload.selfieFaceValidation,
      bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
    });
    localChecksPayload = moneyCashFaceMatch.localChecksPayload ?? localChecksPayload;

    if (!moneyCashFaceMatch.ok) {
      return this.returnKycPipelineFailed({
        applicationId: application.id,
        leadId: lead.id,
        providerName: 'MoneyCash',
        serviceName: 'face-match',
        localChecksPayload,
        vendorChecks,
        faceValidationPassed: true,
        faceMatchPassed: false,
        faceMatchMessage: moneyCashFaceMatch.faceMatchMessage,
        bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
      });
    }

    const checkedAt = new Date();
    await this.persistKycPipelineResult({
      applicationId: application.id,
      localChecksPayload,
      vendorChecks,
      passed: true,
      done: true,
      checkedAt,
    });

    await this.kycCompletion.completeFromDigilockerAadhaar({
      applicationId: application.id,
      customerId: customer.id,
      digilockerAadhaarFormJson: (application.digilockerAadhaarFormJson ?? null) as Prisma.JsonValue,
      aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
      verifiedAt: checkedAt,
    });
    const providerName = (process.env.TENACIO_PROVIDER ?? 'Tenacio').trim();
    await this.internalError.recoverLeadIfVendorFailuresCleared(lead.id, providerName);

    return {
      configured: true,
      ok: true,
      httpStatus: tenacioHttpStatus,
      vendor: mergeVendorPayload(localChecksPayload, vendorChecks),
      livenessPassed: true,
      faceValidationPassed: true,
      faceMatchPassed: true,
      bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
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

  /**
   * Any failed gate (MoneyCash liveness, Tenacio liveness, MoneyCash face match)
   * finalizes the pipeline and escalates the lead to INTERNAL_ERROR (thank-you page).
   */
  private async returnKycPipelineFailed(params: {
    applicationId: bigint;
    leadId: bigint;
    providerName: string;
    serviceName: string;
    httpStatus?: number | null;
    localChecksPayload?: LocalKycChecksPayload;
    vendorChecks?: VendorChecksPayload;
    faceValidationPassed?: boolean;
    faceMatchPassed?: boolean;
    faceMatchMessage?: string;
    bestComputedConfidence: number | null;
    configured?: boolean;
    skipReason?: string;
    vendorErrorMessage?: string;
  }): Promise<RunKycLivenessResult> {
    const localChecksPayload =
      params.localChecksPayload ??
      ({
        selfieFaceValidation: toPersistedSelfieFaceInspection({
          ok: false,
          reason: 'KYC pipeline failed before local checks were recorded.',
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
          emptyFaceMatchInspection('Skipped — pipeline failed.'),
        ),
        pipelineSteps: [],
        localChecksCompletedAt: new Date().toISOString(),
      } satisfies LocalKycChecksPayload);

    const checkedAt = new Date();
    await this.persistKycPipelineResult({
      applicationId: params.applicationId,
      localChecksPayload,
      vendorChecks: params.vendorChecks,
      passed: false,
      done: true,
      checkedAt,
    });

    await this.internalError.handleVendorTechnicalIssue({
      leadId: params.leadId,
      providerName: params.providerName,
      serviceName: params.serviceName,
    });

    return {
      configured: params.configured ?? true,
      skipReason: params.skipReason,
      ok: false,
      httpStatus: params.httpStatus ?? null,
      vendor: mergeVendorPayload(localChecksPayload, params.vendorChecks ?? {}),
      livenessPassed: false,
      internalError: true,
      customerMessage: KYC_VENDOR_TECHNICAL_ISSUE_CUSTOMER_MESSAGE,
      vendorErrorMessage: params.vendorErrorMessage,
      faceValidationPassed: params.faceValidationPassed,
      faceMatchPassed: params.faceMatchPassed,
      faceMatchMessage: params.faceMatchMessage,
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

  /** Step 2 — MoneyCash liveness (on-server selfie face validation). */
  private async runMoneyCashLivenessCheck(params: {
    applicationId: bigint;
    selfieRelativePath: string;
  }): Promise<{
    ok: boolean;
    bestComputedConfidence: number | null;
    localChecksPayload?: LocalKycChecksPayload;
  }> {
    const pipelineSteps: KycLivenessPipelineStepLog[] = [];
    let localCheckOperation: LocalKycCheckOperation = 'read-storage';

    try {
      localCheckOperation = 'read-storage';
      const selfieBuffer = await this.kycFiles.readBytes(params.selfieRelativePath);

      localCheckOperation = 'validate';
      const selfieInspection = await this.selfieFaceValidation.inspectJpegBuffer(selfieBuffer);
      const persistedSelfie = toPersistedSelfieFaceInspection(selfieInspection);
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog('2-moneycash-liveness', {
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

      const localChecksPayload: LocalKycChecksPayload = {
        selfieFaceValidation: persistedSelfie,
        faceMatch: toPersistedFaceMatchInspection(
          emptyFaceMatchInspection(
            selfieInspection.ok
              ? 'Pending — MoneyCash face match runs after Tenacio liveness.'
              : 'Skipped — MoneyCash liveness failed.',
          ),
        ),
        pipelineSteps,
        localChecksCompletedAt: new Date().toISOString(),
      };

      return {
        ok: selfieInspection.ok,
        bestComputedConfidence: selfieInspection.bestComputedConfidence,
        localChecksPayload,
      };
    } catch (err) {
      const failureDetail = describeLocalKycCheckFailure(
        '2-moneycash-liveness',
        localCheckOperation,
        params.selfieRelativePath,
        err,
      );
      this.logger.warn(`MoneyCash liveness failed: ${failureDetail}`);
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog('2-moneycash-liveness', {
          ok: false,
          request: {
            selfieRelativePath: params.selfieRelativePath,
            operation: localCheckOperation,
          },
          response: { error: failureDetail },
        }),
      );

      return {
        ok: false,
        bestComputedConfidence: null,
        localChecksPayload: {
          selfieFaceValidation: toPersistedSelfieFaceInspection({
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
            emptyFaceMatchInspection('Skipped — MoneyCash liveness failed before face match.'),
          ),
          pipelineSteps,
          localChecksCompletedAt: new Date().toISOString(),
        },
      };
    }
  }

  /** Step 4 — MoneyCash face match (Aadhaar reference vs selfie). */
  private async runMoneyCashFaceMatchCheck(params: {
    applicationId: bigint;
    selfieRelativePath: string;
    aadhaarPhotoRelativePath: string | null;
    pipelineSteps: KycLivenessPipelineStepLog[];
    selfieFaceValidation: ReturnType<typeof toPersistedSelfieFaceInspection>;
    bestComputedConfidence: number | null;
  }): Promise<{
    ok: boolean;
    faceMatchMessage?: string;
    localChecksPayload?: LocalKycChecksPayload;
  }> {
    const pipelineSteps = params.pipelineSteps;
    let localCheckOperation: LocalKycCheckOperation = 'read-storage';
    let activeRelativePath = params.selfieRelativePath;
    const phase: LocalKycCheckPhase = '4-moneycash-face-match';

    try {
      const aadhaarPath = params.aadhaarPhotoRelativePath?.trim();
      if (!aadhaarPath) {
        const faceMatchSkipped = toPersistedFaceMatchInspection(
          emptyFaceMatchInspection(
            'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
          ),
        );
        this.recordPipelineStep(
          pipelineSteps,
          buildKycPipelineStepLog(phase, {
            ok: false,
            request: { aadhaarRelativePath: null, selfieRelativePath: params.selfieRelativePath },
            response: faceMatchSkipped,
            skipReason: 'Aadhaar reference photo missing',
          }),
        );
        return {
          ok: false,
          faceMatchMessage:
            'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
          localChecksPayload: {
            selfieFaceValidation: params.selfieFaceValidation,
            faceMatch: faceMatchSkipped,
            pipelineSteps,
            localChecksCompletedAt: new Date().toISOString(),
          },
        };
      }

      localCheckOperation = 'read-storage';
      activeRelativePath = aadhaarPath;
      const aadhaarBuffer = await this.kycFiles.readBytes(aadhaarPath);
      activeRelativePath = params.selfieRelativePath;
      const selfieBuffer = await this.kycFiles.readBytes(params.selfieRelativePath);

      localCheckOperation = 'compare';
      const faceMatchInspection = await this.faceMatch.compareJpegBuffers(aadhaarBuffer, selfieBuffer);
      const persistedFaceMatch = toPersistedFaceMatchInspection(faceMatchInspection);
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog(phase, {
          ok: faceMatchInspection.matchPassed,
          request: {
            aadhaarRelativePath: aadhaarPath,
            selfieRelativePath: params.selfieRelativePath,
          },
          response: persistedFaceMatch,
        }),
      );

      const checkedAt = new Date();
      await this.applications.updateSelfieFaceValidation({
        applicationId: params.applicationId,
        selfieFaceValidationJson: params.selfieFaceValidation,
        passed: true,
        checkedAt,
      });

      return {
        ok: faceMatchInspection.matchPassed,
        faceMatchMessage: faceMatchInspection.matchPassed
          ? undefined
          : (faceMatchInspection.reason ?? 'Your selfie does not match your Aadhaar photo.'),
        localChecksPayload: {
          selfieFaceValidation: params.selfieFaceValidation,
          faceMatch: persistedFaceMatch,
          pipelineSteps,
          localChecksCompletedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      const failureDetail = describeLocalKycCheckFailure(
        phase,
        localCheckOperation,
        activeRelativePath,
        err,
      );
      this.logger.warn(`MoneyCash face match failed: ${failureDetail}`);
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog(phase, {
          ok: false,
          request: {
            aadhaarRelativePath: params.aadhaarPhotoRelativePath?.trim(),
            selfieRelativePath: params.selfieRelativePath,
            operation: localCheckOperation,
          },
          response: { error: failureDetail },
        }),
      );

      return {
        ok: false,
        faceMatchMessage: failureDetail,
        localChecksPayload: {
          selfieFaceValidation: params.selfieFaceValidation,
          faceMatch: toPersistedFaceMatchInspection(
            emptyFaceMatchInspection(`Skipped — ${failureDetail}`),
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
