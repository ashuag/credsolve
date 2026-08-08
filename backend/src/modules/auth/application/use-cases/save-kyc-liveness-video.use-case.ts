import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
import {
  assertApplicationFaceStepNotComplete,
  assertApplicationKycNotFailed,
} from '../../../../common/kyc/application-kyc-guard.util';
import {
  computeHeadPoseSample,
  extractActiveLivenessBlock,
  readHeadMovementSnapshot,
  scoreHeadMovement,
  toPersistedHeadMovement,
  type HeadMovementInspection,
  type HeadPoseSample,
} from '../../../../common/kyc/kyc-head-movement.util';
import { isKycHeadMovementRequired } from '../../../../common/kyc/kyc-liveness-env.util';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { KycSelfieFaceValidationService } from '../../../../common/kyc/kyc-selfie-face-validation.service';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';

const VIDEO_FIELD = 'video';
const FRAME_FIELD = 'frames';
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_FRAMES = 24;

export type SaveKycLivenessVideoResult = {
  success: true;
  passed: boolean;
  /** 0–1 head-movement strength persisted alongside the recording. */
  score: number;
  minScoreRequired: number;
  framesAnalyzed: number;
  framesWithFace: number;
  directions: string[];
  reason: string | null;
  livenessVideoPath: string | null;
};

/**
 * Active liveness: stores the short head-movement recording and scores it.
 *
 * The browser cannot be trusted to score itself and the server has no video decoder, so the
 * client uploads the recording for audit plus JPEG frames sampled from the same stream. Pose is
 * measured per frame here with the same face-api models used for selfie validation.
 */
@Injectable()
export class SaveKycLivenessVideoUseCase {
  private readonly logger = new Logger(SaveKycLivenessVideoUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly kycFiles: KycFilesService,
    private readonly selfieFaceValidation: KycSelfieFaceValidationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    req: Request,
    files: Array<UploadedFileLike>,
  ): Promise<SaveKycLivenessVideoResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const video = files.find((f) => f.fieldname === VIDEO_FIELD);
    const frames = files.filter((f) => f.fieldname === FRAME_FIELD && f.buffer?.length);

    const videoExt = resolveVideoExtension(video);
    if (!video?.buffer?.length || !videoExt) {
      throw new BadRequestException('Record the head-movement video before submitting.');
    }
    if (video.size > MAX_VIDEO_BYTES) {
      throw new BadRequestException('Head-movement recording must be 12MB or smaller.');
    }
    if (!frames.length) {
      throw new BadRequestException('Head-movement frames are missing. Record again.');
    }
    if (frames.length > MAX_FRAMES) {
      throw new BadRequestException('Too many head-movement frames were uploaded.');
    }
    if (frames.some((f) => f.size > MAX_FRAME_BYTES)) {
      throw new BadRequestException('Head-movement frames are too large. Record again.');
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

    /**
     * When head movement is a required check, a recording is still accepted after the rest of
     * the face step finished — otherwise the step is unreachable for applications that passed
     * liveness before this check existed.
     */
    const headMovementOutstanding =
      isKycHeadMovementRequired() &&
      !readHeadMovementSnapshot(extractActiveLivenessBlock(application.livenessVendorJson)).passed;

    if (headMovementOutstanding) {
      assertApplicationKycNotFailed(application.kycStatus);
    } else {
      assertApplicationFaceStepNotComplete({
        kycStatus: application.kycStatus,
        selfieRelativePath: application.selfieRelativePath,
        livenessPassed: application.livenessPassed,
        digilockerAadhaarFormJson: application.digilockerAadhaarFormJson,
      });
    }

    if (!application.selfieRelativePath?.trim()) {
      throw new BadRequestException('Capture your selfie before the head-movement check.');
    }

    const inspection = await this.scoreFrames(frames);

    const relativePath = this.kycFiles.livenessVideoRelativePath(
      customer.uuid,
      application.uuid,
      videoExt,
    );

    // The recording is an audit artifact: keep it even when the score fails, so a reviewer
    // can see what the customer actually did.
    let storedPath: string | null = null;
    try {
      await this.kycFiles.writeBytes(relativePath, video.buffer);
      storedPath = relativePath;
    } catch (err) {
      this.logger.warn(
        `Head-movement video upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.applications.updateActiveLivenessBlock({
      applicationId: application.id,
      activeLiveness: toPersistedHeadMovement(inspection, storedPath) as Prisma.InputJsonObject,
      ...(storedPath ? { livenessVideoPath: storedPath } : {}),
    });

    return {
      success: true,
      passed: inspection.passed,
      score: inspection.score,
      minScoreRequired: inspection.minScoreRequired,
      framesAnalyzed: inspection.framesAnalyzed,
      framesWithFace: inspection.framesWithFace,
      directions: inspection.directions,
      reason: inspection.reason,
      livenessVideoPath: storedPath,
    };
  }

  private async scoreFrames(frames: Array<UploadedFileLike>): Promise<HeadMovementInspection> {
    const poses: Array<HeadPoseSample | null> = [];
    for (const frame of frames) {
      const detection = await this.selfieFaceValidation.detectFrameLandmarks(frame.buffer!);
      poses.push(detection ? computeHeadPoseSample(detection.landmarks) : null);
    }
    return scoreHeadMovement({ poses, framesAnalyzed: frames.length });
  }
}

function resolveVideoExtension(file: UploadedFileLike | undefined): 'webm' | 'mp4' | null {
  const mime = (file?.mimetype ?? '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('quicktime')) return 'mp4';
  return null;
}
