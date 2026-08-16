import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { isApplicationFaceStepComplete } from '../../../../common/kyc/application-kyc-guard.util';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import {
  KYC_FACE_MATCH_RETRY_HINT,
  toPersistedFaceMatchInspection,
} from '../../../../common/kyc/kyc-face-match-inspection-persist.util';
import type { KycFaceMatchInspection } from '../../../../common/kyc/kyc-face-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import {
  readHeadMovementSnapshot,
  type HeadMovementSnapshot,
} from '../../../../common/kyc/kyc-head-movement.util';
import { KycPhotoVerificationService } from '../../../../common/kyc/kyc-photo-verification.service';
import {
  KYC_SELFIE_FACE_RETRY_HINT,
  toPersistedSelfieFaceInspection,
} from '../../../../common/kyc/kyc-selfie-face-inspection-persist.util';
import type { KycSelfieFaceInspection } from '../../../../common/kyc/kyc-selfie-face-validation.util';
import {
  type PhotoQualityChecks,
} from '../../../../common/kyc/kyc-photo-quality-summary.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { isKycHeadMovementRequired } from '../../../../common/kyc/kyc-liveness-env.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * Per-gate photo quality shown to the customer. Mirrors {@link PhotoQualityChecks} without the
 * bulky raw `inspection`, which is persisted but not worth sending to the browser.
 */
export type KycPhotoQualitySummary = Omit<PhotoQualityChecks, 'inspection'>;

export type RunKycLivenessResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  livenessPassed: boolean;
  /** First failing check, surfaced when no more specific message applies. */
  vendorErrorMessage?: string;
  /** When `application.kyc_status` was already completed (no checks re-run). */
  alreadyCompleted?: boolean;
  /** On-server selfie face validation (MoneyCash liveness module). */
  faceValidationPassed?: boolean;
  faceValidationMessage?: string;
  /** On-server Aadhaar vs selfie face match (MoneyCash face-api module). */
  faceMatchPassed?: boolean;
  faceMatchMessage?: string;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
  /** Per-gate blur / lighting / dual-face / framing verdicts for the captured selfie. */
  selfieQuality?: KycPhotoQualitySummary;
  /**
   * Identity-reference metadata for the DigiLocker Aadhaar photo.
   * Quality and liveness are not applied — the customer cannot retake it.
   */
  aadhaarQuality?: KycPhotoQualitySummary;
  /** MoneyCash active liveness (head movement) recorded by `POST kyc/liveness-video`. */
  headMovementPassed?: boolean;
  /** False when no clip has been recorded yet, so the client shows guidance instead of an error. */
  headMovementCaptured?: boolean;
  headMovementScore?: number | null;
  headMovementMessage?: string;
  suggestRetryHeadMovement?: boolean;
};

type LocalKycChecksPayload = {
  selfieFaceValidation: ReturnType<typeof toPersistedSelfieFaceInspection>;
  faceMatch: ReturnType<typeof toPersistedFaceMatchInspection>;
  /** Per-gate verdicts, the same projection the LOS developer tool renders. */
  photoQuality?: {
    selfie: KycPhotoQualitySummary;
    aadhaar: KycPhotoQualitySummary | null;
  };
  localChecksCompletedAt: string;
};

/** Drops the raw inspection so the result stays small enough to ship to the browser. */
function toQualitySummary(quality: PhotoQualityChecks): KycPhotoQualitySummary {
  const { inspection: _inspection, ...summary } = quality;
  return summary;
}

@Injectable()
export class RunKycLivenessUseCase {
  private readonly logger = new Logger(RunKycLivenessUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly photoVerification: KycPhotoVerificationService,
    private readonly prisma: PrismaService,
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

    // Written earlier by `POST kyc/liveness-video`; re-attached below because this pass
    // rewrites `liveness_vendor_json` wholesale.
    const headMovement = readHeadMovementBlock(
      await this.applications.findActiveLivenessBlock(application.id),
    );

    // Gate order mirrors the customer-facing flow: photo quality, then Aadhaar face match, then
    // head movement. A selfie that is too dark or does not match must be reported before the
    // customer is asked to record a clip that would be scored against it.
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
        selfieQuality: localChecks.selfieQuality,
        aadhaarQuality: localChecks.aadhaarQuality,
        vendorErrorMessage: localChecks.faceValidationMessage ?? localChecks.faceMatchMessage,
      };
    }

    // Photo quality and the Aadhaar match are settled; head movement is the last gate.
    if (isKycHeadMovementRequired() && !headMovement.passed) {
      const message =
        headMovement.reason ??
        'Complete the head-movement check — record a short clip while turning your head.';
      return {
        configured: true,
        ok: false,
        httpStatus: null,
        vendor: headMovement.block ? { activeLiveness: headMovement.block } : null,
        livenessPassed: false,
        faceValidationPassed: true,
        faceMatchPassed: true,
        bestComputedConfidence: localChecks.bestComputedConfidence,
        selfieQuality: localChecks.selfieQuality,
        aadhaarQuality: localChecks.aadhaarQuality,
        headMovementPassed: false,
        headMovementCaptured: headMovement.captured,
        headMovementScore: headMovement.score,
        headMovementMessage: message,
        suggestRetryHeadMovement: true,
        vendorErrorMessage: message,
      };
    }

    const localChecksPayload = localChecks.localChecksPayload!;
    const checkedAt = new Date();
    const livenessJson = buildLocalLivenessJson(localChecksPayload, headMovement.block);

    await this.applications.updateLivenessResult({
      applicationId: application.id,
      livenessVendorJson: livenessJson as Prisma.InputJsonValue,
      passed: true,
      checkedAt,
      done: true,
      doneAt: checkedAt,
    });

    await this.kycCompletion.completeAfterFaceLiveness({
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
      vendor: livenessJson,
      livenessPassed: true,
      faceValidationPassed: true,
      faceMatchPassed: true,
      bestComputedConfidence: localChecks.bestComputedConfidence,
      selfieQuality: localChecks.selfieQuality,
      aadhaarQuality: localChecks.aadhaarQuality,
      headMovementPassed: headMovement.passed,
      headMovementCaptured: headMovement.captured,
      headMovementScore: headMovement.score,
    };
  }

  /**
   * Runs {@link KycPhotoVerificationService} — the same pipeline as the LOS
   * `/developer-tools/kyc-face-match-check` tool — against the DigiLocker Aadhaar photo and the
   * captured selfie, then persists the results and turns the failing gate into customer copy.
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
    selfieQuality?: KycPhotoQualitySummary;
    aadhaarQuality?: KycPhotoQualitySummary;
    localChecksPayload?: LocalKycChecksPayload;
  }> {
    try {
      const aadhaarPath = params.aadhaarPhotoRelativePath?.trim();
      if (!aadhaarPath) {
        return {
          ok: false,
          faceValidationPassed: true,
          faceMatchPassed: false,
          faceMatchMessage:
            'Aadhaar reference photo is missing. Complete DigiLocker Aadhaar download first.',
          bestComputedConfidence: null,
        };
      }

      const [aadhaarBuffer, selfieBuffer] = await Promise.all([
        this.kycFiles.readBytes(aadhaarPath),
        this.kycFiles.readBytes(params.selfieRelativePath),
      ]);

      const verification = await this.photoVerification.verifyPair({
        referenceBuffer: aadhaarBuffer,
        probeBuffer: selfieBuffer,
        referenceLabel: 'Aadhaar photo',
        probeLabel: 'Selfie',
      });

      const selfieQuality = toQualitySummary(verification.probeQuality);
      const aadhaarQuality = toQualitySummary(verification.referenceQuality);
      const selfieInspection = verification.probeQuality.inspection;
      const bestComputedConfidence = selfieInspection.bestComputedConfidence;

      await this.applications.updateSelfieFaceValidation({
        applicationId: params.applicationId,
        selfieFaceValidationJson: toPersistedSelfieFaceInspection(selfieInspection),
        passed: verification.probeQuality.ok,
        checkedAt: new Date(),
      });

      if (!verification.probeQuality.ok) {
        const reason = verification.probeQuality.reason ?? 'Selfie face validation failed.';
        // Infrastructure failures (missing TF natives) are not fixed by retaking the photo.
        const isInfraFailure = /tensorflow native bindings failed to load/i.test(reason);
        return {
          ok: false,
          faceValidationPassed: false,
          faceValidationMessage: isInfraFailure ? reason : `${reason} ${KYC_SELFIE_FACE_RETRY_HINT}`,
          suggestRetrySelfie: !isInfraFailure,
          bestComputedConfidence,
          selfieQuality,
          aadhaarQuality,
        };
      }

      const faceMatchInspection = verification.faceMatch!;
      const localChecksPayload = buildLocalChecksPayload(
        selfieInspection,
        faceMatchInspection,
        selfieQuality,
        aadhaarQuality,
      );

      if (!faceMatchInspection.matchPassed) {
        const reason = faceMatchInspection.reason ?? 'Your selfie does not match your Aadhaar photo.';
        return {
          ok: false,
          faceValidationPassed: true,
          faceMatchPassed: false,
          faceMatchMessage: `${reason} ${KYC_FACE_MATCH_RETRY_HINT}`,
          suggestRetrySelfie: true,
          bestComputedConfidence,
          selfieQuality,
          aadhaarQuality,
          localChecksPayload,
        };
      }

      return {
        ok: true,
        bestComputedConfidence,
        selfieQuality,
        aadhaarQuality,
        localChecksPayload,
      };
    } catch (err) {
      this.logger.warn(
        `MoneyCash local KYC checks failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        ok: false,
        faceValidationPassed: false,
        faceValidationMessage: `We could not verify your selfie. ${KYC_SELFIE_FACE_RETRY_HINT}`,
        suggestRetrySelfie: true,
        bestComputedConfidence: null,
      };
    }
  }
}

function buildLocalChecksPayload(
  selfieInspection: KycSelfieFaceInspection,
  faceMatchInspection: KycFaceMatchInspection,
  selfieQuality: KycPhotoQualitySummary,
  aadhaarQuality: KycPhotoQualitySummary,
): LocalKycChecksPayload {
  return {
    selfieFaceValidation: toPersistedSelfieFaceInspection(selfieInspection),
    faceMatch: toPersistedFaceMatchInspection(faceMatchInspection),
    photoQuality: { selfie: selfieQuality, aadhaar: aadhaarQuality },
    localChecksCompletedAt: new Date().toISOString(),
  };
}

/** Local-only `liveness_vendor_json`: no vendor envelope, so LOS reads it as `local-only`. */
function buildLocalLivenessJson(
  localChecks: LocalKycChecksPayload,
  activeLiveness?: Prisma.JsonObject | null,
): Prisma.InputJsonObject {
  return {
    localFaceCheck: true,
    outboundSkipped: true,
    ...(activeLiveness ? { activeLiveness } : {}),
    localChecks,
  } as Prisma.InputJsonObject;
}

/** Reads the head-movement result stored under `liveness_vendor_json.activeLiveness`. */
function readHeadMovementBlock(block: Prisma.JsonObject | null): HeadMovementSnapshot & {
  block: Prisma.JsonObject | null;
} {
  return { ...readHeadMovementSnapshot(block), block };
}
