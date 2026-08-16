import { Injectable } from '@nestjs/common';
import { KycFaceMatchService } from './kyc-face-match.service';
import type { KycFaceMatchInspection } from './kyc-face-match.util';
import {
  summarizeIdentityReferencePhoto,
  summarizePhotoQuality,
  withIdentityMatch,
  type PhotoQualityChecks,
} from './kyc-photo-quality-summary.util';
import { KycSelfieFaceValidationService } from './kyc-selfie-face-validation.service';

export type KycPhotoVerification = {
  /**
   * Aadhaar / ID template. Quality may fail (government photos are often low-res / blurry)
   * and that must not skip or fail the overall check — only the selfie gates + face match do.
   */
  referenceQuality: PhotoQualityChecks;
  probeQuality: PhotoQualityChecks;
  /** Null only when matching was not requested (customer KYC after a selfie quality fail). */
  faceMatch: KycFaceMatchInspection | null;
  /** Selfie quality passed and the faces matched. Reference photo quality is ignored. */
  ok: boolean;
};

/**
 * The single local face-api pipeline behind both the LOS developer tool
 * (`/developer-tools/kyc-face-match-check`) and the customer KYC selfie step, so an operator
 * dry-run and a real application are judged by identical quality + match code:
 *
 * 1. Photo quality + passive still-image liveness on the *selfie only*
 * 2. Aadhaar↔selfie descriptor match (“person correctly identified”)
 *
 * The Aadhaar photo is inspected so operators can see that a government scan is blurry or
 * dark, but that advisory fail never skips face match and never fails KYC. Dual-face /
 * covering / eyes / AI gates also do not apply to the ID photo (holograms are common).
 *
 * Customer KYC skips step 2 when *selfie* quality fails (retake first). The LOS developer tool
 * always runs step 2 so operators can still see a match score.
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
    /** When true (LOS developer tool), still compare faces if selfie quality failed. */
    compareEvenIfQualityFails?: boolean;
  }): Promise<KycPhotoVerification> {
    const [referenceInspection, probeInspection] = await Promise.all([
      this.selfieFaceValidation.inspectJpegBuffer(params.referenceBuffer),
      this.selfieFaceValidation.inspectJpegBuffer(params.probeBuffer),
    ]);

    const referenceQuality = summarizeIdentityReferencePhoto(referenceInspection);
    const probeQuality = summarizePhotoQuality(probeInspection, params.probeLabel ?? 'Selfie');
    const selfieQualityOk = probeQuality.ok;

    if (!selfieQualityOk && !params.compareEvenIfQualityFails) {
      return { referenceQuality, probeQuality, faceMatch: null, ok: false };
    }

    const faceMatch = await this.faceMatch.compareJpegBuffers(
      params.referenceBuffer,
      params.probeBuffer,
    );

    return {
      referenceQuality: withIdentityMatch(referenceQuality, faceMatch.matchPassed),
      probeQuality: withIdentityMatch(probeQuality, faceMatch.matchPassed),
      faceMatch,
      ok: selfieQualityOk && faceMatch.matchPassed,
    };
  }
}
