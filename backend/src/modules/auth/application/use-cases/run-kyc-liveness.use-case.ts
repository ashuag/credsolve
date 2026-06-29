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
  KYC_FACE_MATCH_RETRY_HINT,
  toPersistedFaceMatchInspection,
} from '../../../../common/kyc/kyc-face-match-inspection-persist.util';
import type { KycFaceMatchInspection } from '../../../../common/kyc/kyc-face-match.util';
import { emptyFaceMatchInspection } from '../../../../common/kyc/kyc-face-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../../../../common/kyc/kyc-selfie-face-validation.service';
import {
  KYC_SELFIE_FACE_RETRY_HINT,
  toPersistedSelfieFaceInspection,
} from '../../../../common/kyc/kyc-selfie-face-inspection-persist.util';
import type { KycSelfieFaceInspection } from '../../../../common/kyc/kyc-selfie-face-validation.util';
import { resolveKycLivenessSelfiePublicUrl } from '../../../../common/kyc/kyc-liveness-selfie-url.util';
import {
  buildKycPipelineStepLog,
  formatKycPipelineStepForLogger,
  type KycLivenessPipelineStepLog,
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
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: localChecks.localChecksPayload ?? null,
        livenessPassed: false,
        faceValidationPassed: localChecks.faceValidationPassed,
        faceValidationMessage: localChecks.faceValidationMessage,
        faceMatchPassed: localChecks.faceMatchPassed,
        faceMatchMessage: localChecks.faceMatchMessage,
        suggestRetrySelfie: localChecks.suggestRetrySelfie,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        vendorErrorMessage:
          localChecks.faceValidationMessage ?? localChecks.faceMatchMessage,
      };
    }

    let localChecksPayload = localChecks.localChecksPayload!;

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
        vendorErrorMessage: livenessGate.message,
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
      return {
        configured: faceMatchGate.configured,
        skipReason: faceMatchGate.skipReason,
        ok: false,
        httpStatus: faceMatchGate.httpStatus,
        vendor: mergeVendorPayload(localChecksPayload, vendorChecks),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: false,
        faceMatchMessage: faceMatchGate.message
          ? `${faceMatchGate.message} ${KYC_FACE_MATCH_RETRY_HINT}`
          : undefined,
        suggestRetrySelfie: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        vendorErrorMessage: faceMatchGate.message,
      };
    }

    const businessOk = livenessGate.passed && faceMatchGate.passed;
    const checkedAt = new Date();

    await this.applications.updateLivenessResult({
      applicationId: application.id,
      livenessVendorJson: mergeVendorPayload(localChecksPayload, vendorChecks) as Prisma.InputJsonValue,
      passed: businessOk,
      checkedAt,
      done: businessOk,
      doneAt: businessOk ? checkedAt : null,
    });

    if (businessOk) {
      await this.kycCompletion.completeFromDigilockerAadhaar({
        applicationId: application.id,
        customerId: customer.id,
        digilockerAadhaarFormJson: (application.digilockerAadhaarFormJson ?? null) as Prisma.JsonValue,
        aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
        verifiedAt: checkedAt,
      });
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
      vendorErrorMessage: businessOk ? undefined : livenessGate.message ?? faceMatchGate.message,
    };
  }

  private recordPipelineStep(
    pipelineSteps: KycLivenessPipelineStepLog[],
    entry: KycLivenessPipelineStepLog,
  ): void {
    pipelineSteps.push(entry);
    this.logger.log(formatKycPipelineStepForLogger(entry));
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
    let selfieInspection: KycSelfieFaceInspection;
    let faceMatchInspection: KycFaceMatchInspection;

    try {
      const selfieBuffer = await this.kycFiles.readBytes(params.selfieRelativePath);

      // Step 2 — internal liveness (selfie face validation).
      selfieInspection = await this.selfieFaceValidation.inspectJpegBuffer(selfieBuffer);
      const persistedSelfie = toPersistedSelfieFaceInspection(selfieInspection);
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
          faceValidationMessage: `${reason} ${KYC_SELFIE_FACE_RETRY_HINT}`,
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

      const aadhaarBuffer = await this.kycFiles.readBytes(aadhaarPath);
      faceMatchInspection = await this.faceMatch.compareJpegBuffers(aadhaarBuffer, selfieBuffer);
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
          faceMatchMessage: `${reason} ${KYC_FACE_MATCH_RETRY_HINT}`,
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
      this.logger.warn(
        `MoneyCash local KYC checks failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.recordPipelineStep(
        pipelineSteps,
        buildKycPipelineStepLog('2-internal-liveness', {
          ok: false,
          request: { selfieRelativePath: params.selfieRelativePath },
          response: { error: err instanceof Error ? err.message : String(err) },
        }),
      );
      return {
        ok: false,
        faceValidationPassed: false,
        faceValidationMessage: `We could not verify your selfie before liveness. ${KYC_SELFIE_FACE_RETRY_HINT}`,
        suggestRetrySelfie: true,
        bestComputedConfidence: null,
        localChecksPayload: {
          selfieFaceValidation: toPersistedSelfieFaceInspection({
            ok: false,
            reason: 'Local checks threw before completion.',
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
            emptyFaceMatchInspection('Skipped — local checks error.'),
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
