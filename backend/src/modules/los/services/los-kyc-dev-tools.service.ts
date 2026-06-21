import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
import {
  extractDeepfakeDetected,
  extractDeepfakeScore,
  extractFaceMatchPassed,
  extractFaceMatchScore,
  extractLivenessFaceOccluded,
  extractLivenessIsLive,
  extractLivenessMultipleFacesDetected,
  extractLivenessScore,
  isTenacioVendorBusinessSuccess,
  pickTenacioVendorErrorMessage,
} from '../../../common/kyc/aadhaar-vendor-parse.util';
import { fetchJpegBufferFromUrl } from '../../../common/kyc/kyc-face-match-image.util';
import { KycFaceMatchService } from '../../../common/kyc/kyc-face-match.service';
import type { KycFaceMatchInspection } from '../../../common/kyc/kyc-face-match.util';
import { isPubliclyReachableHttpUrl } from '../../../common/kyc/kyc-liveness-selfie-url.util';
import {
  devToolUploadRelativePath,
  resolveKycPublicObjectUrl,
} from '../../../common/kyc/kyc-public-object-url.util';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import type { KycSelfieFaceInspection } from '../../../common/kyc/kyc-selfie-face-validation.util';
import { KycSelfieFaceValidationService } from '../../../common/kyc/kyc-selfie-face-validation.service';
import { KycTenacioVendorService } from '../../../common/vendor/kyc-tenacio-vendor.service';
import { LivenessVendorService } from '../../../common/vendor/liveness-vendor.service';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export type LosTenacioDryRunResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  vendorErrorMessage?: string;
  businessOk: boolean;
  summary: Record<string, unknown>;
};

export type LosFaceMatchCheckResult = {
  local: KycFaceMatchInspection;
  tenacio: LosTenacioDryRunResult | null;
  businessOk: boolean;
};

export type LosDeepfakeCheckResult = {
  local: KycSelfieFaceInspection;
  tenacio: LosTenacioDryRunResult | null;
  businessOk: boolean;
};

export type LosSelfieFaceCheckResult = {
  local: KycSelfieFaceInspection;
  tenacio: LosTenacioDryRunResult | null;
  businessOk: boolean;
};

@Injectable()
export class LosKycDevToolsService {
  constructor(
    private readonly kycFiles: KycFilesService,
    private readonly kycTenacio: KycTenacioVendorService,
    private readonly liveness: LivenessVendorService,
    private readonly faceMatch: KycFaceMatchService,
    private readonly selfieFaceValidation: KycSelfieFaceValidationService,
  ) {}

  async runSelfieFaceCheck(image: UploadedFileLike | undefined): Promise<LosSelfieFaceCheckResult> {
    this.assertJpeg(image, 'selfie');

    const local = await this.selfieFaceValidation.inspectJpegBuffer(image!.buffer!);

    let tenacio: LosTenacioDryRunResult | null = null;
    if (!this.liveness.isLivenessConfigured()) {
      tenacio = {
        configured: false,
        skipReason: 'Tenacio liveness is not enabled on this environment.',
        ok: true,
        httpStatus: null,
        vendor: null,
        businessOk: true,
        summary: {},
      };
    } else if (!local.ok) {
      tenacio = {
        configured: false,
        skipReason: 'Tenacio liveness skipped because local selfie validation did not pass.',
        ok: true,
        httpStatus: null,
        vendor: null,
        businessOk: true,
        summary: {},
      };
    } else {
      const uploadId = randomUUID();
      const imagePath = devToolUploadRelativePath(uploadId, 'selfie.jpg');
      await this.kycFiles.writeBytes(imagePath, image!.buffer!);

      const urlResult = await resolveKycPublicObjectUrl(this.kycFiles, imagePath);
      if (!urlResult.ok) {
        tenacio = {
          configured: false,
          skipReason: `Tenacio liveness skipped — ${urlResult.error}`,
          ok: true,
          httpStatus: null,
          vendor: null,
          businessOk: local.ok,
          summary: {},
        };
      } else {
        const out = await this.liveness.postLivenessCheck(
          {
            input: {
              consent: true,
              url: urlResult.url,
            },
          },
          null,
          imagePath,
        );

        tenacio = this.buildResult(out, (vendor) => {
          const livenessScore = extractLivenessScore(vendor);
          const isLive = extractLivenessIsLive(vendor);
          const multipleFacesDetected = extractLivenessMultipleFacesDetected(vendor);
          const faceOccluded = extractLivenessFaceOccluded(vendor);
          return {
            livenessScore,
            isLive,
            multipleFacesDetected,
            faceOccluded,
            imageStoredAs: imagePath,
          };
        });
      }
    }

    const businessOk =
      local.ok && (tenacio == null || !tenacio.configured || tenacio.businessOk);

    return { local, tenacio, businessOk };
  }

  async runFaceMatchCheck(params: {
    reference?: UploadedFileLike;
    probe?: UploadedFileLike;
    referenceUrl?: string;
    probeUrl?: string;
  }): Promise<LosFaceMatchCheckResult> {
    const referenceSide = await this.resolveFaceMatchSide({
      file: params.reference,
      directUrl: params.referenceUrl,
      uploadFileName: 'reference.jpg',
      label: 'Reference',
    });
    const probeSide = await this.resolveFaceMatchSide({
      file: params.probe,
      directUrl: params.probeUrl,
      uploadFileName: 'probe.jpg',
      label: 'Probe',
    });

    const local = await this.faceMatch.compareJpegBuffers(referenceSide.buffer, probeSide.buffer);

    let tenacio: LosTenacioDryRunResult | null = null;
    if (!local.matchPassed) {
      tenacio = {
        configured: false,
        skipReason: 'Tenacio face match skipped because local face match did not pass.',
        ok: false,
        httpStatus: null,
        vendor: null,
        businessOk: false,
        summary: {
          referenceSource: referenceSide.meta,
          probeSource: probeSide.meta,
        },
      };
    } else if (referenceSide.tenacioUrl && probeSide.tenacioUrl) {
      const out = await this.kycTenacio.postFaceMatch(
        {
          input: {
            consent: true,
            url1: referenceSide.tenacioUrl,
            url2: probeSide.tenacioUrl,
          },
        },
        null,
      );

      tenacio = this.buildResult(out, (vendor) => {
        const matchScore = extractFaceMatchScore(vendor);
        const matchPassed = extractFaceMatchPassed(vendor);
        return {
          matchScore,
          matchPassed,
          referenceSource: referenceSide.meta,
          probeSource: probeSide.meta,
        };
      });
    } else {
      tenacio = {
        configured: false,
        skipReason:
          'Tenacio face match skipped — both sides need a public HTTPS URL (uploaded files must resolve to a public URL, or paste direct URLs).',
        ok: false,
        httpStatus: null,
        vendor: null,
        businessOk: local.matchPassed,
        summary: {
          referenceSource: referenceSide.meta,
          probeSource: probeSide.meta,
        },
      };
    }

    const businessOk =
      local.matchPassed && (tenacio == null || !tenacio.configured || tenacio.businessOk);

    return { local, tenacio, businessOk };
  }

  async runDeepfakeCheck(image: UploadedFileLike | undefined): Promise<LosDeepfakeCheckResult> {
    this.assertJpeg(image, 'image');

    const local = await this.selfieFaceValidation.inspectJpegBuffer(image!.buffer!);

    let tenacio: LosTenacioDryRunResult | null = null;
    if (!this.kycTenacio.isDeepfakeConfigured()) {
      tenacio = {
        configured: false,
        skipReason: 'Tenacio deepfake is not enabled on this environment.',
        ok: true,
        httpStatus: null,
        vendor: null,
        businessOk: true,
        summary: {},
      };
    } else if (!local.ok) {
      tenacio = {
        configured: false,
        skipReason: 'Tenacio deepfake skipped because local selfie validation did not pass.',
        ok: true,
        httpStatus: null,
        vendor: null,
        businessOk: true,
        summary: {},
      };
    } else {
      const uploadId = randomUUID();
      const imagePath = devToolUploadRelativePath(uploadId, 'image.jpg');
      await this.kycFiles.writeBytes(imagePath, image!.buffer!);

      const urlResult = await resolveKycPublicObjectUrl(this.kycFiles, imagePath);
      if (!urlResult.ok) {
        tenacio = {
          configured: false,
          skipReason: `Tenacio deepfake skipped — ${urlResult.error}`,
          ok: true,
          httpStatus: null,
          vendor: null,
          businessOk: local.ok,
          summary: {},
        };
      } else {
        const out = await this.kycTenacio.postDeepfakeCheck(
          {
            input: {
              consent: true,
              url: urlResult.url,
            },
          },
          null,
        );

        tenacio = this.buildResult(out, (vendor) => {
          const deepfakeDetected = extractDeepfakeDetected(vendor);
          const authenticityScore = extractDeepfakeScore(vendor);
          return {
            deepfakeDetected,
            authenticityScore,
            imageStoredAs: imagePath,
          };
        });
      }
    }

    const businessOk =
      local.ok && (tenacio == null || !tenacio.configured || tenacio.businessOk);

    return { local, tenacio, businessOk };
  }

  private buildResult(
    out: {
      configured: boolean;
      skipReason?: string;
      ok: boolean;
      httpStatus: number | null;
      vendorBody: unknown | null;
    },
    summaryForVendor: (vendor: unknown) => Record<string, unknown>,
  ): LosTenacioDryRunResult {
    const vendor = out.vendorBody ?? null;
    const summary = summaryForVendor(vendor);

    if (!out.configured) {
      return {
        configured: false,
        skipReason: out.skipReason,
        ok: out.ok,
        httpStatus: out.httpStatus,
        vendor: null,
        businessOk: true,
        summary,
      };
    }

    const vendorStatusOk = out.ok && isTenacioVendorBusinessSuccess(vendor);

    let businessOk = vendorStatusOk;
    if (summary.matchPassed === false) businessOk = false;
    if (summary.deepfakeDetected === true) businessOk = false;
    if (summary.isLive === false) businessOk = false;
    if (summary.multipleFacesDetected === true) businessOk = false;
    if (summary.faceOccluded === true) businessOk = false;

    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendor,
      vendorErrorMessage: vendorStatusOk ? undefined : pickTenacioVendorErrorMessage(vendor) ?? out.skipReason,
      businessOk,
      summary,
    };
  }

  private async resolveFaceMatchSide(params: {
    file?: UploadedFileLike;
    directUrl?: string;
    uploadFileName: string;
    label: string;
  }): Promise<{
    buffer: Buffer;
    tenacioUrl: string | null;
    meta: { type: 'upload' | 'url'; storedAs?: string; url?: string };
  }> {
    const trimmedUrl = params.directUrl?.trim();
    const hasFile = Boolean(params.file?.buffer?.length);

    if (trimmedUrl && hasFile) {
      throw new BadRequestException(`${params.label}: provide either an uploaded image or a URL, not both.`);
    }

    if (trimmedUrl) {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        throw new BadRequestException(`${params.label} URL must start with http:// or https://.`);
      }

      let buffer: Buffer;
      try {
        buffer = await fetchJpegBufferFromUrl(trimmedUrl);
      } catch (err) {
        throw new BadRequestException(
          `${params.label} URL could not be fetched: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const tenacioUrl = isPubliclyReachableHttpUrl(trimmedUrl) ? trimmedUrl : null;
      return {
        buffer,
        tenacioUrl,
        meta: { type: 'url', url: trimmedUrl },
      };
    }

    this.assertJpeg(params.file, params.label.toLowerCase());

    const uploadId = randomUUID();
    const storedPath = devToolUploadRelativePath(uploadId, params.uploadFileName);
    await this.kycFiles.writeBytes(storedPath, params.file!.buffer!);

    const resolved = await resolveKycPublicObjectUrl(this.kycFiles, storedPath);
    const tenacioUrl = resolved.ok ? resolved.url : null;

    return {
      buffer: params.file!.buffer!,
      tenacioUrl,
      meta: { type: 'upload', storedAs: storedPath, url: tenacioUrl ?? undefined },
    };
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
