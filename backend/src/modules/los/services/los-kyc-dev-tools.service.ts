import { BadRequestException, Injectable } from '@nestjs/common';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
import { fetchJpegBufferFromUrl } from '../../../common/kyc/kyc-face-match-image.util';
import type { KycFaceMatchInspection } from '../../../common/kyc/kyc-face-match.util';
import type { PhotoQualityChecks } from '../../../common/kyc/kyc-photo-quality-summary.util';
import { KycPhotoVerificationService } from '../../../common/kyc/kyc-photo-verification.service';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export type { PhotoQualityChecks };

/** @deprecated Use {@link PhotoQualityChecks}. */
export type ProbeQualityChecks = PhotoQualityChecks;

export type LosFaceMatchCheckResult = {
  referenceQuality: PhotoQualityChecks;
  probeQuality: PhotoQualityChecks;
  local: KycFaceMatchInspection | null;
  businessOk: boolean;
};

/**
 * LOS developer dry-run. Resolves the two images, then defers to
 * {@link KycPhotoVerificationService} — the same pipeline the customer KYC selfie step runs —
 * so this tool predicts the real verdict rather than approximating it. No Tenacio, no DB writes.
 * Aadhaar quality is advisory (government photos are often low-res); face match still runs.
 */
@Injectable()
export class LosKycDevToolsService {
  constructor(private readonly photoVerification: KycPhotoVerificationService) {}

  async runFaceMatchCheck(params: {
    reference?: UploadedFileLike;
    probe?: UploadedFileLike;
    referenceUrl?: string;
    probeUrl?: string;
  }): Promise<LosFaceMatchCheckResult> {
    const referenceBuffer = await this.resolveImageBuffer({
      file: params.reference,
      directUrl: params.referenceUrl,
      label: 'Reference (Aadhaar)',
    });
    const probeBuffer = await this.resolveImageBuffer({
      file: params.probe,
      directUrl: params.probeUrl,
      label: 'Probe (selfie)',
    });

    const verification = await this.photoVerification.verifyPair({
      referenceBuffer,
      probeBuffer,
      referenceLabel: 'Reference photo',
      probeLabel: 'Selfie',
      compareEvenIfQualityFails: true,
    });

    return {
      referenceQuality: verification.referenceQuality,
      probeQuality: verification.probeQuality,
      local: verification.faceMatch,
      businessOk: verification.ok,
    };
  }

  private async resolveImageBuffer(params: {
    file?: UploadedFileLike;
    directUrl?: string;
    label: string;
  }): Promise<Buffer> {
    const trimmedUrl = params.directUrl?.trim();
    const hasFile = Boolean(params.file?.buffer?.length);

    if (trimmedUrl && hasFile) {
      throw new BadRequestException(
        `${params.label}: provide either an uploaded image or a URL, not both.`,
      );
    }

    if (trimmedUrl) {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        throw new BadRequestException(`${params.label} URL must start with http:// or https://.`);
      }
      try {
        return await fetchJpegBufferFromUrl(trimmedUrl);
      } catch (err) {
        throw new BadRequestException(
          `${params.label} URL could not be fetched: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.assertJpeg(params.file, params.label);
    return params.file!.buffer!;
  }

  private assertJpeg(file: UploadedFileLike | undefined, label: string): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException(`Please provide a ${label} JPEG image or a public ${label} URL.`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`${label} image must be 6MB or smaller.`);
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    if (!mime.includes('jpeg') && !mime.includes('jpg')) {
      throw new BadRequestException(`${label} image must be a JPEG.`);
    }
  }
}
