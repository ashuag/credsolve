import { Injectable } from '@nestjs/common';
import { KycFaceMatchService } from './kyc-face-match.service';
import type { KycFaceMatchInspection } from './kyc-face-match.util';
import { summarizePhotoQuality, type PhotoQualityChecks } from './kyc-photo-quality-summary.util';
import { KycSelfieFaceValidationService } from './kyc-selfie-face-validation.service';

export type KycPhotoVerification = {
  referenceQuality: PhotoQualityChecks;
  probeQuality: PhotoQualityChecks;
  /** Null when either photo failed its quality gates — matching is not attempted. */
  faceMatch: KycFaceMatchInspection | null;
  /** Both photos passed quality and the faces matched. */
  ok: boolean;
};

/**
 * The single local face-api pipeline behind both the LOS developer tool
 * (`/developer-tools/kyc-face-match-check`) and the customer KYC selfie step, so an operator
 * dry-run and a real application are judged by identical code:
 *
 * 1. Photo quality on *both* images — face detection, dual-face, framing, occlusion, blur,
 *    skin-tone-aware lighting, composite confidence
 * 2. Aadhaar↔selfie descriptor match, attempted only when both photos pass step 1
 *
 * Purely on-server: no vendor calls, no persistence. Callers own storage and messaging.
 */
@Injectable()
export class KycPhotoVerificationService {
  constructor(
    private readonly selfieFaceValidation: KycSelfieFaceValidationService,
    private readonly faceMatch: KycFaceMatchService,
  ) {}

  async verifyPair(params: {
    referenceBuffer: Buffer;
    probeBuffer: Buffer;
    referenceLabel?: string;
    probeLabel?: string;
  }): Promise<KycPhotoVerification> {
    const [referenceInspection, probeInspection] = await Promise.all([
      this.selfieFaceValidation.inspectJpegBuffer(params.referenceBuffer),
      this.selfieFaceValidation.inspectJpegBuffer(params.probeBuffer),
    ]);

    const referenceQuality = summarizePhotoQuality(
      referenceInspection,
      params.referenceLabel ?? 'Reference photo',
    );
    const probeQuality = summarizePhotoQuality(probeInspection, params.probeLabel ?? 'Selfie');

    if (!referenceQuality.ok || !probeQuality.ok) {
      return { referenceQuality, probeQuality, faceMatch: null, ok: false };
    }

    const faceMatch = await this.faceMatch.compareJpegBuffers(
      params.referenceBuffer,
      params.probeBuffer,
    );

    return { referenceQuality, probeQuality, faceMatch, ok: faceMatch.matchPassed };
  }
}
