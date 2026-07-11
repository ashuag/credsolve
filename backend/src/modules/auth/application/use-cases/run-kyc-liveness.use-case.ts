import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { isApplicationFaceStepComplete } from '../../../../common/kyc/application-kyc-guard.util';
import { KycCompletionService } from '../../../../common/kyc/kyc-completion.service';
import { KycActiveLivenessService } from '../../../../common/kyc/kyc-active-liveness.service';
import {
  type ActiveLivenessChallenge,
  isActiveLivenessChallenge,
} from '../../../../common/kyc/kyc-active-liveness.util';
import type { ExpressionFrameMetric } from '../../../../common/kyc/kyc-face-expression.util';
import { KycFaceMatchService } from '../../../../common/kyc/kyc-face-match.service';
import {
  toPersistedFaceMatchInspection,
} from '../../../../common/kyc/kyc-face-match-inspection-persist.util';
import { emptyFaceMatchInspection } from '../../../../common/kyc/kyc-face-match.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { encodeLivenessFramesToWebm } from '../../../../common/kyc/kyc-liveness-video-from-frames.util';
import { KycSelfieFaceValidationService } from '../../../../common/kyc/kyc-selfie-face-validation.service';
import { toPersistedSelfieFaceInspection } from '../../../../common/kyc/kyc-selfie-face-inspection-persist.util';
import {
  buildKycPipelineStepLog,
  describeLocalKycCheckFailure,
  formatKycPipelineStepForLogger,
  type KycLivenessPipelineStepLog,
  type LocalKycCheckOperation,
  type LocalKycCheckPhase,
} from '../../../../common/kyc/kyc-liveness-pipeline-log.util';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import {
  KYC_LIVENESS_MAX_ATTEMPTS,
  KYC_VENDOR_TECHNICAL_ISSUE_CUSTOMER_MESSAGE,
} from '../../../../common/constants/kyc.constants';
import { VendorInternalErrorService } from '../../../../common/vendor/vendor-internal-error.service';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  parseSmoothLivenessSegments,
  smoothSegmentFrameTotal,
  type SmoothLivenessSegment,
} from '../../../../common/kyc/kyc-smooth-liveness-segments.util';

/** Minimum distinct challenges the customer must complete for a valid active-liveness run. */
const MIN_ACTIVE_LIVENESS_CHALLENGES = 2;
/** Max size for the uploaded liveness recording. */
const MAX_LIVENESS_VIDEO_BYTES = 25 * 1024 * 1024;

export type ActiveLivenessChallengeSegment = {
  challenge: ActiveLivenessChallenge;
  count: number;
};

/** Multipart payload posted by the customer active-liveness step. */
export type RunKycLivenessInput = {
  /** Short recording of the whole liveness session (webm/mp4). Stored as an audit artifact. */
  video?: UploadedFileLike;
  /** JPEG frame bursts for all challenges, concatenated in `challenges` order. */
  frames: UploadedFileLike[];
  /** Challenge sequence with per-challenge frame counts (legacy multi-challenge mode). */
  challenges?: ActiveLivenessChallengeSegment[];
  /** `smooth` = one continuous head-turn + smile session with expression anti-spoof (recommended). */
  mode?: 'smooth' | 'challenges';
  /** Per-phase frame counts for smooth mode (baseline → turn → smile). */
  smoothSegments?: SmoothLivenessSegment[];
};

export type RunKycLivenessResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  livenessPassed: boolean;
  vendorErrorMessage?: string;
  /** When `application.kyc_status` was already completed (no checks run). */
  alreadyCompleted?: boolean;
  /** On-server selfie face validation (MoneyCash liveness module). */
  faceValidationPassed?: boolean;
  faceValidationMessage?: string;
  /** On-server Aadhaar vs selfie face match (MoneyCash face-api module). */
  faceMatchPassed?: boolean;
  faceMatchMessage?: string;
  /** On-server active (challenge–response) liveness result. */
  activeLivenessPassed?: boolean;
  activeLivenessMessage?: string;
  expressionAntiSpoofPassed?: boolean;
  expressionAntiSpoofMessage?: string;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
  /** Generic customer copy (never raw errors). */
  customerMessage?: string;
  /** Terminal pipeline failure — attempts exhausted, lead escalated to INTERNAL_ERROR; show thank-you. */
  internalError?: boolean;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  attemptsRemaining?: number;
};

type LocalKycChecksPayload = {
  selfieFaceValidation: ReturnType<typeof toPersistedSelfieFaceInspection>;
  faceMatch: ReturnType<typeof toPersistedFaceMatchInspection>;
  pipelineSteps: KycLivenessPipelineStepLog[];
  localChecksCompletedAt: string;
};

type ActiveLivenessChallengePayload = {
  challenge: ActiveLivenessChallenge | 'smooth';
  passed: boolean;
  reason: string;
  framesAnalyzed: number;
  framesWithFace: number;
  aggregates: Record<string, number | null | boolean | string>;
  validationDisabled: boolean;
  expressionAntiSpoof?: {
    passed: boolean;
    reason: string;
    aggregates: Record<string, number | null | boolean | string>;
  };
};

type VendorChecksPayload = {
  expressionAntiSpoof?: {
    passed: boolean;
    reason: string;
    aggregates: Record<string, number | null | boolean | string>;
  };
  activeLiveness?: {
    passed: boolean;
    validationDisabled: boolean;
    challenges: ActiveLivenessChallengePayload[];
    videoStored: boolean;
    videoPath: string | null;
  };
};

@Injectable()
export class RunKycLivenessUseCase {
  private readonly logger = new Logger(RunKycLivenessUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly activeLiveness: KycActiveLivenessService,
    private readonly kycFiles: KycFilesService,
    private readonly selfieFaceValidation: KycSelfieFaceValidationService,
    private readonly faceMatch: KycFaceMatchService,
    private readonly prisma: PrismaService,
    private readonly kycCompletion: KycCompletionService,
    private readonly internalError: VendorInternalErrorService,
  ) {}

  async execute(req: Request, input: RunKycLivenessInput): Promise<RunKycLivenessResult> {
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

    if (
      application.livenessCheckCompleted &&
      !application.livenessPassed &&
      application.livenessAttempts < KYC_LIVENESS_MAX_ATTEMPTS
    ) {
      await this.applications.reopenLivenessPipeline(application.id);
      application.livenessCheckCompleted = false;
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
      throw new BadRequestException('Capture your selfie before running liveness.');
    }

    const mode = input.mode === 'challenges' ? 'challenges' : 'smooth';
    if (!input.frames.length) {
      throw new BadRequestException('No liveness frames were received. Please retry.');
    }
    const challenges =
      mode === 'challenges' ? this.validateChallengeSegments(input) : null;

    const selfieRelativePath = application.selfieRelativePath.trim();

    const storedLivenessVideoPath = await this.storeLivenessVideo({
      video: input.video,
      frames: input.frames,
      customerUuid: customer.uuid,
      applicationUuid: application.uuid,
      pipelineSteps: [],
    });
    if (storedLivenessVideoPath) {
      try {
        await this.applications.updateLivenessVideoPath({
          applicationId: application.id,
          livenessVideoPath: storedLivenessVideoPath,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to persist liveness video path (applicationId=${application.id.toString()}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // Step 1 — MoneyCash selfie quality (face validation).
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

    // Step 2 — MoneyCash face match (Aadhaar vs selfie).
    const moneyCashFaceMatch = await this.runMoneyCashFaceMatchCheck({
      applicationId: application.id,
      selfieRelativePath,
      aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
      pipelineSteps: localChecksPayload.pipelineSteps,
      selfieFaceValidation: localChecksPayload.selfieFaceValidation,
    });
    localChecksPayload = moneyCashFaceMatch.localChecksPayload ?? localChecksPayload;

    if (!moneyCashFaceMatch.ok) {
      return this.returnKycPipelineFailed({
        applicationId: application.id,
        leadId: lead.id,
        providerName: 'MoneyCash',
        serviceName: 'face-match',
        localChecksPayload,
        faceValidationPassed: true,
        faceMatchPassed: false,
        faceMatchMessage: moneyCashFaceMatch.faceMatchMessage,
        bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
      });
    }

    // Steps 3–4 — expression anti-spoof, then active liveness (smooth or legacy challenges).
    const smoothFrameBuffers =
      mode === 'smooth'
        ? input.frames
            .map((f) => f.buffer)
            .filter((b): b is Buffer => Boolean(b?.length))
        : [];
    if (mode === 'smooth' && smoothFrameBuffers.length < 8) {
      throw new BadRequestException('Not enough liveness frames were received. Please try again.');
    }

    const smoothFrameMetrics =
      mode === 'smooth'
        ? await this.activeLiveness.measureSmoothSessionFrames(smoothFrameBuffers)
        : null;

    let vendorChecks: VendorChecksPayload = {};
    let activeGate: {
      passed: boolean;
      message?: string;
      payload: NonNullable<VendorChecksPayload['activeLiveness']>;
    };

    if (mode === 'smooth' && smoothFrameMetrics) {
      const expressionGate = this.runExpressionAntiSpoofCheck({
        frameMetrics: smoothFrameMetrics,
        pipelineSteps: localChecksPayload.pipelineSteps,
      });
      vendorChecks = { expressionAntiSpoof: expressionGate.payload };

      if (!expressionGate.passed) {
        return this.returnKycPipelineFailed({
          applicationId: application.id,
          leadId: lead.id,
          providerName: 'MoneyCash',
          serviceName: 'expression-anti-spoof',
          localChecksPayload,
          vendorChecks,
          faceValidationPassed: true,
          faceMatchPassed: true,
          expressionAntiSpoofPassed: false,
          expressionAntiSpoofMessage: expressionGate.payload.reason,
          bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
        });
      }

      activeGate = this.runSmoothActiveLivenessCheck({
        frameMetrics: smoothFrameMetrics,
        smoothSegments: input.smoothSegments,
        pipelineSteps: localChecksPayload.pipelineSteps,
      });
    } else {
      activeGate = await this.runActiveLivenessCheck({
        frames: input.frames,
        challenges: challenges!,
        pipelineSteps: localChecksPayload.pipelineSteps,
      });
    }

    vendorChecks = { ...vendorChecks, activeLiveness: activeGate.payload };
    if (storedLivenessVideoPath && activeGate.payload) {
      activeGate.payload.videoStored = true;
      activeGate.payload.videoPath = storedLivenessVideoPath;
    }

    if (!activeGate.passed) {
      return this.returnKycPipelineFailed({
        applicationId: application.id,
        leadId: lead.id,
        providerName: 'MoneyCash',
        serviceName: 'active-liveness',
        localChecksPayload,
        vendorChecks,
        faceValidationPassed: true,
        faceMatchPassed: true,
        activeLivenessPassed: false,
        activeLivenessMessage: activeGate.message,
        bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
      });
    }

    // All checks passed — liveness video was already stored at the start of the run.
    if (activeGate.payload) {
      activeGate.payload.videoStored = Boolean(storedLivenessVideoPath);
      activeGate.payload.videoPath = storedLivenessVideoPath;
    }
    vendorChecks = { ...vendorChecks, activeLiveness: activeGate.payload };

    const checkedAt = new Date();
    await this.persistKycPipelineResult({
      applicationId: application.id,
      localChecksPayload,
      vendorChecks,
      passed: true,
      done: true,
      checkedAt,
    });
    // Best-effort: the video key is also recorded inside `livenessVendorJson`, so a
    // failure here (e.g. column missing) never blocks KYC completion.
    if (storedLivenessVideoPath) {
      try {
        await this.applications.updateLivenessVideoPath({
          applicationId: application.id,
          livenessVideoPath: storedLivenessVideoPath,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to persist liveness video path (applicationId=${application.id.toString()}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.kycCompletion.completeFromDigilockerAadhaar({
      applicationId: application.id,
      customerId: customer.id,
      digilockerAadhaarFormJson: (application.digilockerAadhaarFormJson ?? null) as Prisma.JsonValue,
      aadhaarPhotoRelativePath: application.aadhaarPhotoRelativePath,
      verifiedAt: checkedAt,
    });
    const providerName = (process.env.TENACIO_PROVIDER ?? 'MoneyCash').trim();
    await this.internalError.recoverLeadIfVendorFailuresCleared(lead.id, providerName);

    return {
      configured: true,
      ok: true,
      httpStatus: 200,
      vendor: mergeVendorPayload(localChecksPayload, vendorChecks),
      livenessPassed: true,
      faceValidationPassed: true,
      activeLivenessPassed: true,
      faceMatchPassed: true,
      bestComputedConfidence: moneyCashLiveness.bestComputedConfidence,
    };
  }

  /** Validates the challenge sequence + that the frame counts line up with the uploaded frames. */
  private validateChallengeSegments(input: RunKycLivenessInput): ActiveLivenessChallengeSegment[] {
    const segments = Array.isArray(input.challenges) ? input.challenges : [];
    if (segments.length < MIN_ACTIVE_LIVENESS_CHALLENGES) {
      throw new BadRequestException(
        `Complete at least ${MIN_ACTIVE_LIVENESS_CHALLENGES} liveness actions before submitting.`,
      );
    }

    let total = 0;
    for (const seg of segments) {
      if (!isActiveLivenessChallenge(seg?.challenge)) {
        throw new BadRequestException('Invalid liveness action received. Please retry.');
      }
      if (!Number.isInteger(seg.count) || seg.count <= 0) {
        throw new BadRequestException('Invalid liveness frame data received. Please retry.');
      }
      total += seg.count;
    }

    if (!input.frames.length) {
      throw new BadRequestException('No liveness frames were received. Please retry.');
    }
    if (total !== input.frames.length) {
      throw new BadRequestException('Liveness frame data was incomplete. Please retry.');
    }
    return segments;
  }

  /** Step 3 — expression anti-spoof on the smooth-session frame burst. */
  private runExpressionAntiSpoofCheck(params: {
    frameMetrics: ExpressionFrameMetric[];
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): {
    passed: boolean;
    payload: NonNullable<VendorChecksPayload['expressionAntiSpoof']>;
  } {
    const antiSpoof = this.activeLiveness.evaluateExpressionAntiSpoofFromFrames(params.frameMetrics);

    this.recordPipelineStep(
      params.pipelineSteps,
      buildKycPipelineStepLog('3-expression-anti-spoof', {
        ok: antiSpoof.passed,
        request: { mode: 'smooth', frames: params.frameMetrics.length },
        response: antiSpoof,
      }),
    );

    return { passed: antiSpoof.passed, payload: antiSpoof };
  }

  /** Step 4 (smooth) — head turns + smile only (expression anti-spoof runs separately). */
  private runSmoothActiveLivenessCheck(params: {
    frameMetrics: ExpressionFrameMetric[];
    smoothSegments?: SmoothLivenessSegment[] | null;
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): {
    passed: boolean;
    message?: string;
    payload: NonNullable<VendorChecksPayload['activeLiveness']>;
  } {
    const analysis = this.activeLiveness.evaluateSmoothActiveLivenessFromFrames(
      params.frameMetrics,
      { segments: params.smoothSegments },
    );
    const payload: ActiveLivenessChallengePayload = {
      challenge: 'smooth',
      passed: analysis.passed,
      reason: analysis.reason,
      framesAnalyzed: analysis.framesAnalyzed,
      framesWithFace: analysis.framesWithFace,
      aggregates: analysis.aggregates,
      validationDisabled: analysis.validationDisabled,
    };

    this.recordPipelineStep(
      params.pipelineSteps,
      buildKycPipelineStepLog('4-active-liveness', {
        ok: analysis.passed,
        request: { mode: 'smooth', frames: params.frameMetrics.length },
        response: payload,
      }),
    );

    return {
      passed: analysis.passed,
      message: analysis.passed ? undefined : analysis.reason,
      payload: {
        passed: analysis.passed,
        validationDisabled: analysis.validationDisabled,
        challenges: [payload],
        videoStored: false,
        videoPath: null,
      },
    };
  }

  /** Step 4 (legacy) — run each challenge's frame burst through the on-server active-liveness analyzer. */
  private async runActiveLivenessCheck(params: {
    frames: UploadedFileLike[];
    challenges: ActiveLivenessChallengeSegment[];
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): Promise<{
    passed: boolean;
    message?: string;
    payload: NonNullable<VendorChecksPayload['activeLiveness']>;
  }> {
    const challengePayloads: ActiveLivenessChallengePayload[] = [];
    let offset = 0;
    let passed = true;
    let firstFailure: string | undefined;
    let validationDisabled = false;

    for (const seg of params.challenges) {
      const slice = params.frames.slice(offset, offset + seg.count);
      offset += seg.count;
      const buffers = slice
        .map((f) => f.buffer)
        .filter((b): b is Buffer => Boolean(b?.length));

      const analysis = await this.activeLiveness.analyzeFrames(seg.challenge, buffers);
      validationDisabled = validationDisabled || analysis.validationDisabled;

      const payload: ActiveLivenessChallengePayload = {
        challenge: seg.challenge,
        passed: analysis.passed,
        reason: analysis.reason,
        framesAnalyzed: analysis.framesAnalyzed,
        framesWithFace: analysis.framesWithFace,
        aggregates: analysis.aggregates,
        validationDisabled: analysis.validationDisabled,
      };
      challengePayloads.push(payload);

      this.recordPipelineStep(
        params.pipelineSteps,
        buildKycPipelineStepLog('4-active-liveness', {
          ok: analysis.passed,
          request: { challenge: seg.challenge, frames: seg.count },
          response: payload,
        }),
      );

      if (!analysis.passed) {
        passed = false;
        firstFailure = firstFailure ?? analysis.reason;
      }
    }

    return {
      passed,
      message: firstFailure,
      payload: {
        passed,
        validationDisabled,
        challenges: challengePayloads,
        videoStored: false,
        videoPath: null,
      },
    };
  }

  /** Persists the short liveness recording to object storage. Best-effort — never blocks completion. */
  private async storeLivenessVideo(params: {
    video?: UploadedFileLike;
    frames?: UploadedFileLike[];
    customerUuid: string;
    applicationUuid: string;
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): Promise<string | null> {
    const uploaded = await this.storeUploadedLivenessVideo(params);
    if (uploaded) return uploaded;
    return this.storeLivenessVideoFromFrames(params);
  }

  private inferLivenessVideoExt(video: UploadedFileLike): 'webm' | 'mp4' | null {
    const mime = (video.mimetype ?? '').toLowerCase();
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('mp4') || mime.includes('quicktime')) return 'mp4';

    const name = (video.originalname ?? '').toLowerCase();
    if (name.endsWith('.webm')) return 'webm';
    if (name.endsWith('.mp4')) return 'mp4';

    const buf = video.buffer;
    if (!buf?.length) return null;
    if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return 'webm';
    }
    if (
      buf.length >= 12 &&
      buf[4] === 0x66 &&
      buf[5] === 0x74 &&
      buf[6] === 0x79 &&
      buf[7] === 0x70
    ) {
      return 'mp4';
    }

    if (!mime || mime === 'application/octet-stream') return 'webm';
    return null;
  }

  private async storeUploadedLivenessVideo(params: {
    video?: UploadedFileLike;
    customerUuid: string;
    applicationUuid: string;
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): Promise<string | null> {
    const video = params.video;
    if (!video?.buffer?.length) return null;

    const ext = this.inferLivenessVideoExt(video);
    if (!ext) {
      this.logger.warn(`Liveness video rejected — unsupported mime "${video.mimetype ?? 'unknown'}".`);
      return null;
    }
    if (video.size > MAX_LIVENESS_VIDEO_BYTES) {
      this.logger.warn(`Liveness video rejected — ${video.size} bytes exceeds limit.`);
      return null;
    }

    const rel = this.kycFiles.livenessVideoRelativePath(
      params.customerUuid,
      params.applicationUuid,
      ext,
    );
    try {
      await this.kycFiles.writeBytes(rel, video.buffer);
      this.recordPipelineStep(
        params.pipelineSteps,
        buildKycPipelineStepLog('4-active-liveness', {
          ok: true,
          request: { operation: 'store-video', bytes: video.buffer.length, mime: video.mimetype ?? ext },
          response: { livenessVideoPath: rel },
        }),
      );
      return rel;
    } catch (err) {
      this.logger.warn(
        `Failed to store liveness video (${rel}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async storeLivenessVideoFromFrames(params: {
    frames?: UploadedFileLike[];
    customerUuid: string;
    applicationUuid: string;
    pipelineSteps: KycLivenessPipelineStepLog[];
  }): Promise<string | null> {
    const frameBuffers =
      params.frames
        ?.map((frame) => frame.buffer)
        .filter((buffer): buffer is Buffer => Boolean(buffer?.length)) ?? [];
    if (frameBuffers.length < 2) return null;

    const encoded = await encodeLivenessFramesToWebm(frameBuffers);
    if (!encoded?.length) return null;

    const rel = this.kycFiles.livenessVideoRelativePath(
      params.customerUuid,
      params.applicationUuid,
      'webm',
    );
    try {
      await this.kycFiles.writeBytes(rel, encoded);
      this.recordPipelineStep(
        params.pipelineSteps,
        buildKycPipelineStepLog('4-active-liveness', {
          ok: true,
          request: { operation: 'store-video-from-frames', frameCount: frameBuffers.length },
          response: { livenessVideoPath: rel },
        }),
      );
      return rel;
    } catch (err) {
      this.logger.warn(
        `Failed to store liveness video from frames (${rel}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
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
   * Any failed gate (MoneyCash liveness, active liveness, MoneyCash face match)
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
    activeLivenessPassed?: boolean;
    activeLivenessMessage?: string;
    expressionAntiSpoofPassed?: boolean;
    expressionAntiSpoofMessage?: string;
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

    // Count this failure. The customer may retry the liveness actions until the
    // attempt budget is spent; only then do we finalize the KYC step and escalate.
    const attemptsUsed = await this.applications.incrementLivenessAttempts(params.applicationId);
    const attemptsAllowed = KYC_LIVENESS_MAX_ATTEMPTS;
    const attemptsRemaining = Math.max(0, attemptsAllowed - attemptsUsed);
    const exhausted = attemptsUsed >= attemptsAllowed;

    const checkedAt = new Date();
    await this.persistKycPipelineResult({
      applicationId: params.applicationId,
      localChecksPayload,
      vendorChecks: params.vendorChecks,
      passed: false,
      done: exhausted,
      checkedAt,
    });

    if (exhausted) {
      await this.internalError.handleVendorTechnicalIssue({
        leadId: params.leadId,
        providerName: params.providerName,
        serviceName: params.serviceName,
      });
    } else {
      this.logger.warn(
        `KYC pipeline failed (application=${params.applicationId.toString()}, ${params.providerName}/${params.serviceName}) — attempt ${attemptsUsed}/${attemptsAllowed}; ${attemptsRemaining} retr${
          attemptsRemaining === 1 ? 'y' : 'ies'
        } left before escalation.`,
      );
    }

    return {
      configured: params.configured ?? true,
      skipReason: params.skipReason,
      ok: false,
      httpStatus: params.httpStatus ?? null,
      vendor: mergeVendorPayload(localChecksPayload, params.vendorChecks ?? {}),
      livenessPassed: false,
      internalError: exhausted,
      customerMessage: exhausted ? KYC_VENDOR_TECHNICAL_ISSUE_CUSTOMER_MESSAGE : undefined,
      vendorErrorMessage: params.vendorErrorMessage,
      faceValidationPassed: params.faceValidationPassed,
      activeLivenessPassed: params.activeLivenessPassed,
      activeLivenessMessage: params.activeLivenessMessage,
      expressionAntiSpoofPassed: params.expressionAntiSpoofPassed,
      expressionAntiSpoofMessage: params.expressionAntiSpoofMessage,
      faceMatchPassed: params.faceMatchPassed,
      faceMatchMessage: params.faceMatchMessage,
      suggestRetrySelfie: !exhausted,
      bestComputedConfidence: params.bestComputedConfidence,
      attemptsUsed,
      attemptsAllowed,
      attemptsRemaining,
    };
  }

  /** Step 1 — MoneyCash selfie quality (on-server face validation). */
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
              ? 'Pending — runs after selfie quality passes.'
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

  /** Step 2 — MoneyCash face match (Aadhaar reference vs selfie). */
  private async runMoneyCashFaceMatchCheck(params: {
    applicationId: bigint;
    selfieRelativePath: string;
    aadhaarPhotoRelativePath: string | null;
    pipelineSteps: KycLivenessPipelineStepLog[];
    selfieFaceValidation: ReturnType<typeof toPersistedSelfieFaceInspection>;
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
