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
import { evaluateTenacioDeepfakeResult } from '../../../../common/kyc/kyc-deepfake-eval.util';
import { isKycDeepfakeRequired } from '../../../../common/kyc/kyc-deepfake-env.util';
import { KycFaceMatchService } from '../../../../common/kyc/kyc-face-match.service';
import {
  KYC_FACE_MATCH_RETRY_HINT,
  toPersistedFaceMatchInspection,
} from '../../../../common/kyc/kyc-face-match-inspection-persist.util';
import type { KycFaceMatchInspection } from '../../../../common/kyc/kyc-face-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../../../../common/kyc/kyc-selfie-face-validation.service';
import {
  KYC_SELFIE_FACE_RETRY_HINT,
  toPersistedSelfieFaceInspection,
} from '../../../../common/kyc/kyc-selfie-face-inspection-persist.util';
import type { KycSelfieFaceInspection } from '../../../../common/kyc/kyc-selfie-face-validation.util';
import { resolveKycLivenessSelfiePublicUrl } from '../../../../common/kyc/kyc-liveness-selfie-url.util';
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
  /** Tenacio deepfake / synthetic media check (catches AI-generated photos local ML cannot). */
  authenticityPassed?: boolean;
  authenticityMessage?: string;
  deepfakeDetected?: boolean | null;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
};

type LocalKycChecksPayload = {
  selfieFaceValidation: ReturnType<typeof toPersistedSelfieFaceInspection>;
  faceMatch: ReturnType<typeof toPersistedFaceMatchInspection>;
  tenacioDeepfake?: {
    configured: boolean;
    passed: boolean;
    deepfakeDetected: boolean | null;
    authenticityScore: number | null;
    skipReason?: string;
    vendor: unknown;
    httpStatus: number | null;
  };
  localChecksCompletedAt: string;
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
        authenticityPassed: localChecks.authenticityPassed,
        suggestRetrySelfie: localChecks.suggestRetrySelfie,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        vendorErrorMessage:
          localChecks.faceValidationMessage ??
          localChecks.faceMatchMessage ??
          localChecks.authenticityMessage,
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
        selfieRelativePath,
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
        authenticityPassed: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
      };
    }

    const applicationFresh = await this.prisma.client.application.findUnique({
      where: { id: application.id },
      select: { updatedAt: true },
    });
    const photoVersion = applicationFresh?.updatedAt?.getTime() ?? Date.now();

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
        vendor: { localChecks: localChecksPayload },
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: true,
        vendorErrorMessage: selfieUrlResult.error,
      };
    }

    const deepfakeGate = await this.runTenacioDeepfakeCheck({
      leadId: lead.id,
      selfieUrl: selfieUrlResult.url,
    });
    localChecksPayload = {
      ...localChecksPayload,
      tenacioDeepfake: deepfakeGate.payload,
    };

    if (!deepfakeGate.ok) {
      return {
        configured: deepfakeGate.configured,
        skipReason: deepfakeGate.skipReason,
        ok: false,
        httpStatus: deepfakeGate.httpStatus,
        vendor: { localChecks: localChecksPayload },
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: true,
        authenticityPassed: false,
        authenticityMessage: deepfakeGate.message,
        deepfakeDetected: deepfakeGate.deepfakeDetected,
        suggestRetrySelfie: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        vendorErrorMessage: deepfakeGate.message,
      };
    }

    const selfieRelativePathForVendor = application.selfieRelativePath.trim();
    const livenessInput = { input: { consent: true, url: selfieUrlResult.url } };
    this.logger.log(
      `Tenacio liveness selfiePath=${selfieRelativePathForVendor} input=${JSON.stringify(livenessInput)}`,
    );

    const out = await this.liveness.postLivenessCheck(livenessInput, lead.id, selfieRelativePathForVendor);

    if (!out.configured) {
      const vendor = out.vendorBody ?? null;
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: false,
        httpStatus: out.httpStatus,
        vendor: mergeLocalChecksWithVendor(localChecksPayload, vendor),
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: true,
        authenticityPassed: deepfakeGate.passed,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        vendorErrorMessage: pickTenacioVendorErrorMessage(vendor) ?? out.skipReason,
      };
    }

    const vendor = out.vendorBody ?? null;
    const vendorStatusOk = out.ok && isTenacioVendorBusinessSuccess(vendor);

    const minScore = await this.settings.loadMinLivenessApiScore();
    const livenessScore = extractLivenessScore(vendor);
    const scoreOk = livenessScore === null || livenessScore >= minScore;

    const isLive = extractLivenessIsLive(vendor);
    const isLiveOk = isLive === null || isLive === true;

    const multipleFaces = extractLivenessMultipleFacesDetected(vendor);
    const multipleFacesOk = multipleFaces === null || multipleFaces === false;

    const faceOccluded = extractLivenessFaceOccluded(vendor);
    const faceOccludedOk = faceOccluded === null || faceOccluded === false;

    const businessOk = vendorStatusOk && scoreOk && isLiveOk && multipleFacesOk && faceOccludedOk;
    const checkedAt = new Date();

    await this.applications.updateLivenessResult({
      applicationId: application.id,
      livenessVendorJson: mergeLocalChecksWithVendor(localChecksPayload, vendor) as Prisma.InputJsonValue,
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
        selfieRelativePath: application.selfieRelativePath.trim(),
        verifiedAt: checkedAt,
      });
    }

    return {
      configured: true,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendor: mergeLocalChecksWithVendor(localChecksPayload, vendor),
      livenessPassed: businessOk,
      faceValidationPassed: true,
      faceMatchPassed: true,
      authenticityPassed: deepfakeGate.passed,
      bestComputedConfidence: localChecks.bestComputedConfidence,
      vendorErrorMessage: businessOk ? undefined : pickTenacioVendorErrorMessage(vendor),
    };
  }

  private async runTenacioDeepfakeCheck(params: {
    leadId: bigint;
    selfieUrl: string;
  }): Promise<{
    ok: boolean;
    configured: boolean;
    passed: boolean;
    skipReason?: string;
    httpStatus: number | null;
    message?: string;
    deepfakeDetected: boolean | null;
    payload: NonNullable<LocalKycChecksPayload['tenacioDeepfake']>;
  }> {
    const deepfakeRequired = isKycDeepfakeRequired();
    const deepfakeConfigured = this.kycTenacio.isDeepfakeConfigured();

    if (!deepfakeConfigured) {
      const payload: NonNullable<LocalKycChecksPayload['tenacioDeepfake']> = {
        configured: false,
        passed: !deepfakeRequired,
        deepfakeDetected: null,
        authenticityScore: null,
        skipReason: deepfakeRequired
          ? 'Tenacio deepfake is required but TENACIO_DEEPFAKE_WORKFLOW_ID is not configured.'
          : 'Tenacio deepfake not configured — local ML cannot detect AI-generated images.',
        vendor: null,
        httpStatus: null,
      };

      if (deepfakeRequired) {
        return {
          ok: false,
          configured: false,
          passed: false,
          skipReason: payload.skipReason,
          httpStatus: null,
          message: payload.skipReason,
          deepfakeDetected: null,
          payload,
        };
      }

      this.logger.warn(
        'Tenacio deepfake skipped — AI/synthetic selfies may pass local ML only. Set TENACIO_DEEPFAKE_WORKFLOW_ID or KYC_DEEPFAKE_REQUIRED=true.',
      );
      return {
        ok: true,
        configured: false,
        passed: true,
        httpStatus: null,
        deepfakeDetected: null,
        payload,
      };
    }

    this.logger.log('Tenacio deepfake check before liveness (selfie URL redacted in audit log)');
    const out = await this.kycTenacio.postDeepfakeCheck(
      { input: { consent: true, url: params.selfieUrl } },
      params.leadId,
    );

    const evaluation = evaluateTenacioDeepfakeResult({
      configured: out.configured,
      httpOk: out.ok,
      vendor: out.vendorBody,
      skipReason: out.skipReason,
    });

    const payload: NonNullable<LocalKycChecksPayload['tenacioDeepfake']> = {
      configured: true,
      passed: evaluation.passed,
      deepfakeDetected: evaluation.deepfakeDetected,
      authenticityScore: evaluation.authenticityScore,
      vendor: out.vendorBody ?? null,
      httpStatus: out.httpStatus,
    };

    if (!evaluation.passed) {
      const message =
        evaluation.vendorErrorMessage ??
        'This photo could not be verified as authentic. Please capture a live selfie from your camera.';
      return {
        ok: false,
        configured: true,
        passed: false,
        httpStatus: out.httpStatus,
        message,
        deepfakeDetected: evaluation.deepfakeDetected,
        payload,
      };
    }

    return {
      ok: true,
      configured: true,
      passed: true,
      httpStatus: out.httpStatus,
      deepfakeDetected: evaluation.deepfakeDetected,
      payload,
    };
  }

  /**
   * MoneyCash on-server KYC gates (in order):
   * 1. Selfie liveness / face validation (face-api detection, blur, landmarks)
   * 2. Face match vs DigiLocker Aadhaar photo (face-api descriptors)
   * Then Tenacio deepfake (synthetic/AI detection) and Tenacio liveness when outbound is enabled.
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
    authenticityPassed?: boolean;
    authenticityMessage?: string;
    suggestRetrySelfie?: boolean;
    bestComputedConfidence: number | null;
    localChecksPayload?: LocalKycChecksPayload;
  }> {
    let selfieInspection: KycSelfieFaceInspection;
    let faceMatchInspection: KycFaceMatchInspection;

    try {
      const selfieBuffer = await this.kycFiles.readBytes(params.selfieRelativePath);

      // Step 1 — MoneyCash liveness module (selfie face validation).
      selfieInspection = await this.selfieFaceValidation.inspectJpegBuffer(selfieBuffer);
      const checkedAt = new Date();
      await this.applications.updateSelfieFaceValidation({
        applicationId: params.applicationId,
        selfieFaceValidationJson: toPersistedSelfieFaceInspection(selfieInspection),
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
        };
      }

      // Step 2 — MoneyCash face match module (Aadhaar reference vs selfie).
      const aadhaarPath = params.aadhaarPhotoRelativePath?.trim();
      if (!aadhaarPath) {
        return {
          ok: false,
          faceValidationPassed: true,
          faceMatchPassed: false,
          faceMatchMessage: 'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
          bestComputedConfidence: selfieInspection.bestComputedConfidence,
        };
      }

      const aadhaarBuffer = await this.kycFiles.readBytes(aadhaarPath);
      faceMatchInspection = await this.faceMatch.compareJpegBuffers(aadhaarBuffer, selfieBuffer);

      if (!faceMatchInspection.matchPassed) {
        const reason = faceMatchInspection.reason ?? 'Your selfie does not match your Aadhaar photo.';
        return {
          ok: false,
          faceValidationPassed: true,
          faceMatchPassed: false,
          faceMatchMessage: `${reason} ${KYC_FACE_MATCH_RETRY_HINT}`,
          suggestRetrySelfie: true,
          bestComputedConfidence: selfieInspection.bestComputedConfidence,
          localChecksPayload: buildLocalChecksPayload(selfieInspection, faceMatchInspection),
        };
      }

      return {
        ok: true,
        bestComputedConfidence: selfieInspection.bestComputedConfidence,
        localChecksPayload: buildLocalChecksPayload(selfieInspection, faceMatchInspection),
      };
    } catch (err) {
      this.logger.warn(
        `MoneyCash local KYC checks failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        ok: false,
        faceValidationPassed: false,
        faceValidationMessage: `We could not verify your selfie before liveness. ${KYC_SELFIE_FACE_RETRY_HINT}`,
        suggestRetrySelfie: true,
        bestComputedConfidence: null,
      };
    }
  }
}

function buildLocalChecksPayload(
  selfieInspection: KycSelfieFaceInspection,
  faceMatchInspection: KycFaceMatchInspection,
): LocalKycChecksPayload {
  return {
    selfieFaceValidation: toPersistedSelfieFaceInspection(selfieInspection),
    faceMatch: toPersistedFaceMatchInspection(faceMatchInspection),
    localChecksCompletedAt: new Date().toISOString(),
  };
}

function mergeLocalChecksWithVendor(
  localChecks: LocalKycChecksPayload,
  vendor: unknown,
): Prisma.InputJsonObject {
  const base =
    vendor && typeof vendor === 'object' && !Array.isArray(vendor)
      ? ({ ...(vendor as Record<string, unknown>) } as Record<string, unknown>)
      : vendor != null
        ? { tenacio: vendor }
        : {};
  return {
    ...base,
    localChecks,
  } as Prisma.InputJsonObject;
}
