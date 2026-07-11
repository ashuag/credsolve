import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UploadedFileLike } from '../../common/types/uploaded-file';
import { LosAuthGuard } from './auth/los-auth.guard';
import { ActiveLivenessCheckDto } from './dto/active-liveness-check.dto';
import { KycFaceMatchCheckDto } from './dto/kyc-face-match-check.dto';
import { LosKycDevToolsService } from './services/los-kyc-dev-tools.service';

const MAX_SELFIE_BYTES = 6 * 1024 * 1024;
const MAX_ACTIVE_LIVENESS_FRAMES = 30;

@ApiTags('LOS Developer Tools')
@Controller(['los/developer-tools', 'los/los/developer-tools'])
@UseGuards(LosAuthGuard)
export class LosDeveloperToolsController {
  constructor(private readonly kycDevTools: LosKycDevToolsService) {}

  @Post('kyc-selfie-face-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('selfie', {
      limits: { fileSize: MAX_SELFIE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Dry-run KYC selfie face validation (local ML first, then Tenacio liveness when configured)',
    description:
      'Runs on-server face detection used by customer selfie upload, then Tenacio liveness when local validation passes and a public selfie URL is available.',
  })
  async kycSelfieFaceCheck(@UploadedFile() selfie: UploadedFileLike | undefined) {
    return this.kycDevTools.runSelfieFaceCheck(selfie);
  }

  @Post('kyc-face-match-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'reference', maxCount: 1 },
        { name: 'probe', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_SELFIE_BYTES } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Dry-run face match (local ML first, then Tenacio when configured)',
    description:
      'Compares reference vs probe using on-server face-api embeddings, then optionally calls Tenacio when local match passes and public URLs are available.',
  })
  async kycFaceMatchCheck(
    @UploadedFiles()
    files: { reference?: UploadedFileLike[]; probe?: UploadedFileLike[] } | undefined,
    @Body() body: KycFaceMatchCheckDto,
  ) {
    return this.kycDevTools.runFaceMatchCheck({
      reference: files?.reference?.[0],
      probe: files?.probe?.[0],
      referenceUrl: body.referenceUrl,
      probeUrl: body.probeUrl,
    });
  }

  @Post('active-liveness-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('frames', MAX_ACTIVE_LIVENESS_FRAMES, {
      limits: { fileSize: MAX_SELFIE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Active (challenge-response) liveness check on a burst of captured frames',
    description:
      'Runs on-server face-api landmark detection across the uploaded frames and verifies the requested action (blink / turn head / smile / open mouth) actually happened.',
  })
  async activeLivenessCheck(
    @UploadedFiles() frames: UploadedFileLike[] | undefined,
    @Body() body: ActiveLivenessCheckDto,
  ) {
    return this.kycDevTools.runActiveLivenessCheck({
      challenge: body.challenge,
      frames: frames ?? [],
    });
  }

  @Post('active-liveness-face-position')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('frame', {
      limits: { fileSize: MAX_SELFIE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Detect face position in a single frame (used to gate the active liveness run)',
    description: 'Returns the detected face box + normalized center so the UI can confirm the face is inside the guide oval before starting.',
  })
  async activeLivenessFacePosition(@UploadedFile() frame: UploadedFileLike | undefined) {
    return this.kycDevTools.runActiveLivenessFacePosition(frame);
  }
}
