import { BadRequestException, Injectable } from '@nestjs/common';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
import {
  SurepassFaceLivenessService,
  type SurepassFaceLivenessResult,
} from '../../../common/vendor/surepass/surepass-face-liveness.service';

const MAX_FILE_BYTES = 6 * 1024 * 1024;

/**
 * LOS developer tool: live Surepass face-liveness check
 * (`POST /api/v1/face/face-liveness`). Bypasses no vendor switch — Surepass is the
 * only face-liveness vendor wired in. The call is live and audited in
 * `vendor_api_log`; no lead or KYC record is created or updated.
 */
@Injectable()
export class LosFaceLivenessDevToolsService {
  constructor(private readonly faceLiveness: SurepassFaceLivenessService) {}

  async runFaceLivenessCheck(params: {
    file?: UploadedFileLike;
    link?: string;
    usePdf?: boolean;
  }): Promise<SurepassFaceLivenessResult> {
    const link = params.link?.trim();
    const hasFile = Boolean(params.file?.buffer?.length);

    if (link && hasFile) {
      throw new BadRequestException('Provide either an uploaded file or a link, not both.');
    }
    if (!link && !hasFile) {
      throw new BadRequestException('Provide a face image/PDF file or a public image link.');
    }
    if (link && !/^https?:\/\//i.test(link)) {
      throw new BadRequestException('link must start with http:// or https://.');
    }
    if (hasFile && params.file!.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File must be 6MB or smaller.');
    }

    return this.faceLiveness.checkFaceLiveness(
      {
        file: hasFile
          ? {
              buffer: params.file!.buffer!,
              filename: params.file!.originalname,
              mimetype: params.file!.mimetype,
            }
          : undefined,
        link,
        usePdf: params.usePdf,
      },
      null,
    );
  }
}
