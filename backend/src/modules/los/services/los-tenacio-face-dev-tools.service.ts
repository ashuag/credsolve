import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { devToolUploadRelativePath, resolveKycPublicObjectUrl } from '../../../common/kyc/kyc-public-object-url.util';
import { KycTenacioVendorService } from '../../../common/vendor/kyc-tenacio-vendor.service';
import { LivenessVendorService } from '../../../common/vendor/liveness-vendor.service';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
import type { TenacioFaceLivenessCheckDto } from '../dto/tenacio-face-liveness-check.dto';
import type { TenacioFaceMatchCheckDto } from '../dto/tenacio-face-match-check.dto';

const MAX_FILE_BYTES = 6 * 1024 * 1024;

export type TenacioFaceDevToolResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

/**
 * LOS developer tools: live Tenacio face-liveness and face-match checks, calling
 * `LivenessVendorService` / `KycTenacioVendorService` directly. Tenacio fetches the
 * image itself from a public URL — it does not accept a file upload or base64 body —
 * so an uploaded photo is first written to S3 under `dev-tools/los-uploads/{uploadId}/…`
 * (`devToolUploadRelativePath`) and resolved to a public/presigned HTTPS URL before the
 * Tenacio call. Calls are live and audited in `vendor_api_log`; no lead or KYC record is
 * created or updated. Uploaded objects are not cleaned up automatically — see
 * `S3_PRESIGNED_EXPIRES_SEC` in `.env` for how long the resolved URL stays fetchable.
 */
@Injectable()
export class LosTenacioFaceDevToolsService {
  private readonly logger = new Logger(LosTenacioFaceDevToolsService.name);

  constructor(
    private readonly liveness: LivenessVendorService,
    private readonly kycTenacio: KycTenacioVendorService,
    private readonly kycFiles: KycFilesService,
  ) {}

  async runFaceLivenessCheck(
    dto: TenacioFaceLivenessCheckDto,
    file: UploadedFileLike | undefined,
  ): Promise<TenacioFaceDevToolResult> {
    const url = await this.resolveImageUrl(file, dto.link, 'Selfie');

    return this.liveness.postLivenessCheck({ input: { consent: dto.consent ?? true, url } }, null);
  }

  async runFaceMatchCheck(
    dto: TenacioFaceMatchCheckDto,
    files: { file1?: UploadedFileLike; file2?: UploadedFileLike },
  ): Promise<TenacioFaceDevToolResult> {
    const [url1, url2] = await Promise.all([
      this.resolveImageUrl(files.file1, dto.url1, 'Reference photo'),
      this.resolveImageUrl(files.file2, dto.url2, 'Selfie photo'),
    ]);

    return this.kycTenacio.postFaceMatch({ input: { consent: dto.consent ?? true, url1, url2 } }, null);
  }

  /** Resolves a single side (reference or selfie) to a public URL — either the given link, or an uploaded file pushed to S3. */
  private async resolveImageUrl(
    file: UploadedFileLike | undefined,
    link: string | undefined,
    label: string,
  ): Promise<string> {
    const trimmedLink = link?.trim();
    const hasFile = Boolean(file?.buffer?.length);

    if (trimmedLink && hasFile) {
      throw new BadRequestException(`${label}: provide either an uploaded file or a link, not both.`);
    }
    if (!trimmedLink && !hasFile) {
      throw new BadRequestException(`${label}: provide an uploaded file or a public image link.`);
    }
    if (trimmedLink) {
      if (!/^https?:\/\//i.test(trimmedLink)) {
        throw new BadRequestException(`${label} link must start with http:// or https://.`);
      }
      return trimmedLink;
    }

    if (file!.size > MAX_FILE_BYTES) {
      throw new BadRequestException(`${label} must be 6MB or smaller.`);
    }

    const uploadId = randomUUID();
    const fileName = sanitizeFileName(file!.originalname, file!.mimetype);
    const relativePath = devToolUploadRelativePath(uploadId, fileName);

    await this.kycFiles.writeBytes(relativePath, file!.buffer!);

    const resolved = await resolveKycPublicObjectUrl(this.kycFiles, relativePath);
    if (!resolved.ok) {
      throw new BadRequestException(`${label}: could not resolve a public URL for the upload — ${resolved.error}`);
    }

    this.logger.log(`${label} uploaded to ${relativePath}, resolved URL: ${resolved.url}`);
    return resolved.url;
  }
}

function sanitizeFileName(originalName: string, mimetype: string): string {
  const fallbackExt = mimetype.includes('png') ? 'png' : mimetype.includes('pdf') ? 'pdf' : 'jpg';
  const trimmed = (originalName || '').trim();
  if (!trimmed) return `file.${fallbackExt}`;
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  return safe.includes('.') ? safe : `${safe}.${fallbackExt}`;
}
