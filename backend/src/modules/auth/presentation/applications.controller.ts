import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor, FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
import {
  parseSmoothLivenessSegments,
  smoothSegmentFrameTotal,
  type SmoothLivenessSegment,
} from '../../../common/kyc/kyc-smooth-liveness-segments.util';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { VpnBlockGuard } from '../../../common/ip-reputation/vpn-block.guard';
import { LookupIfscDto } from '../application/dto/lookup-ifsc.dto';
import { SubmitVerifiedBankDto } from '../application/dto/submit-verified-bank.dto';
import { SaveBankDetailsDto } from '../application/dto/save-bank-details.dto';
import { SaveLoanSelectionDto } from '../application/dto/save-loan-selection.dto';
import { LookupIfscUseCase } from '../application/use-cases/lookup-ifsc.use-case';
import { SubmitVerifiedBankUseCase } from '../application/use-cases/submit-verified-bank.use-case';
import { SaveBankDetailsUseCase } from '../application/use-cases/save-bank-details.use-case';
import { SaveKycDocumentsUseCase } from '../application/use-cases/save-kyc-documents.use-case';
import { SaveKycSelfieUseCase } from '../application/use-cases/save-kyc-selfie.use-case';
import {
  RunKycLivenessUseCase,
  type ActiveLivenessChallengeSegment,
} from '../application/use-cases/run-kyc-liveness.use-case';
import { CheckKycFacePositionUseCase } from '../application/use-cases/check-kyc-face-position.use-case';
import { SaveLoanSelectionUseCase } from '../application/use-cases/save-loan-selection.use-case';
import { SaveProfessionalDetailsDto } from '../application/dto/save-professional-details.dto';
import { SubmitProfessionalApplicationUseCase } from '../application/use-cases/submit-professional-application.use-case';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('applications')
@Controller('applications')
@UseGuards(RedisIpRateLimitGuard, VpnBlockGuard, RequiredCustomerSessionGuard)
export class ApplicationsController {
  constructor(
    private readonly submitProfessionalApplication: SubmitProfessionalApplicationUseCase,
    private readonly saveLoanSelection: SaveLoanSelectionUseCase,
    private readonly saveKycDocuments: SaveKycDocumentsUseCase,
    private readonly saveKycSelfie: SaveKycSelfieUseCase,
    private readonly runKycLiveness: RunKycLivenessUseCase,
    private readonly checkKycFacePosition: CheckKycFacePositionUseCase,
    private readonly saveBankDetails: SaveBankDetailsUseCase,
    private readonly lookupIfsc: LookupIfscUseCase,
    private readonly submitVerifiedBank: SubmitVerifiedBankUseCase
  ) {}

  @Post('professional-details')
  @RateLimitByRoute('professional-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Save professional / income fields, run eligibility, store approved amount, set lead to CONVERTED',
  })
  @ApiOkResponse({
    description: 'Eligibility outcome; approvedAmount and bureau score (`cibilScore` in API) when eligible',
  })
  professionalDetailsRoute(@Req() req: Request, @Body() body: SaveProfessionalDetailsDto) {
    return this.submitProfessionalApplication.execute(req, body);
  }

  @Post('selection')
  @RateLimitByRoute('loan-selection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save selected loan amount and tenure calculations for the active application' })
  @ApiOkResponse({ description: 'Loan selection stored' })
  selectionRoute(@Req() req: Request, @Body() body: SaveLoanSelectionDto) {
    return this.saveLoanSelection.execute(req, body);
  }

  @Post('kyc/documents')
  @RateLimitByRoute('kyc-documents')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  @ApiOperation({ summary: 'Save KYC numbers + uploaded Aadhaar front/back images' })
  @ApiOkResponse({ description: 'KYC document references stored' })
  kycDocumentsRoute(
    @Req() req: Request,
    @UploadedFiles() files: Array<UploadedFileLike>
  ) {
    return this.saveKycDocuments.execute(req, files ?? []);
  }

  @Post('kyc/selfie')
  @RateLimitByRoute('kyc-selfie')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('selfie', {
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Store customer selfie JPEG for the active application (webcam / camera)',
    description:
      'Validates that exactly one unobstructed face is visible (eyes, nose, mouth) before storing. Set KYC_SELFIE_FACE_VALIDATION_DISABLED=true to skip in local dev.',
  })
  @ApiOkResponse({ description: 'Selfie stored under customer UUID / selfie / application UUID' })
  kycSelfieRoute(@Req() req: Request, @UploadedFile() selfie: UploadedFileLike | undefined) {
    return this.saveKycSelfie.execute(req, selfie);
  }

  @Post('kyc/face-position')
  @RateLimitByRoute('kyc-face-position')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('frame', {
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      'Single-frame face-position probe used to gate the active-liveness run (face must be inside the guide oval).',
  })
  @ApiOkResponse({ description: 'Detected face box + normalized position, or faceDetected=false' })
  kycFacePositionRoute(@Req() req: Request, @UploadedFile() frame: UploadedFileLike | undefined) {
    return this.checkKycFacePosition.execute(req, frame);
  }

  @Post('kyc/liveness')
  @RateLimitByRoute('kyc-liveness')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'frames', maxCount: 120 },
      ],
      { limits: { fileSize: 25 * 1024 * 1024 } },
    ),
  )
  @ApiOperation({
    summary:
      'KYC pipeline: (1) MoneyCash selfie quality, (2) MoneyCash Aadhaar face match, (3) expression anti-spoof, (4) active liveness — smooth head-turn + smile session (default) or legacy per-challenge mode.',
  })
  @ApiOkResponse({ description: 'Pipeline outcome; completes KYC when all checks pass' })
  kycLivenessRoute(
    @Req() req: Request,
    @UploadedFiles() files: { video?: UploadedFileLike[]; frames?: UploadedFileLike[] } | undefined,
    @Body('challenges') challengesRaw?: string,
    @Body('smoothSegments') smoothSegmentsRaw?: string,
    @Body('mode') modeRaw?: string,
  ) {
    const mode = (modeRaw ?? 'smooth').trim().toLowerCase() === 'challenges' ? 'challenges' : 'smooth';
    const frames = files?.frames ?? [];
    let smoothSegments: SmoothLivenessSegment[] | undefined;
    if (mode === 'smooth' && smoothSegmentsRaw?.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(smoothSegmentsRaw);
      } catch {
        throw new BadRequestException('Invalid smooth liveness segment metadata.');
      }
      smoothSegments = parseSmoothLivenessSegments(parsed) ?? undefined;
      if (!smoothSegments) {
        throw new BadRequestException('Invalid smooth liveness segment metadata.');
      }
      if (smoothSegmentFrameTotal(smoothSegments) !== frames.length) {
        throw new BadRequestException('Smooth liveness frame count does not match segment metadata.');
      }
    }
    return this.runKycLiveness.execute(req, {
      video: files?.video?.[0],
      frames,
      challenges: mode === 'challenges' ? parseActiveLivenessChallenges(challengesRaw) : undefined,
      smoothSegments,
      mode,
    });
  }

  @Post('bank/ifsc-lookup')
  @RateLimitByRoute('bank-ifsc-lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve IFSC via Tenacio (input.ifscNumber + consent); returns data for customer review' })
  @ApiOkResponse({ description: 'Vendor envelope + parsed `details` when present' })
  lookupIfscRoute(@Req() req: Request, @Body() body: LookupIfscDto) {
    return this.lookupIfsc.execute(req, body);
  }

  @Post('bank/submit-verified')
  @RateLimitByRoute('bank-submit-verified')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Penny-drop verify account + IFSC (Tenacio), then save disbursement and set application to IN_REVIEW',
  })
  @ApiOkResponse({ description: 'success + pennyDropOk + applicationStatus when saved' })
  submitVerifiedBankRoute(@Req() req: Request, @Body() body: SubmitVerifiedBankDto) {
    return this.submitVerifiedBank.execute(req, body);
  }

  @Post('bank-details')
  @RateLimitByRoute('bank-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save customer bank details for disbursement' })
  @ApiOkResponse({ description: 'Bank details saved' })
  bankDetailsRoute(@Req() req: Request, @Body() body: SaveBankDetailsDto) {
    return this.saveBankDetails.execute(req, body);
  }
}

/** Parses the `challenges` JSON field from the multipart active-liveness request. */
function parseActiveLivenessChallenges(raw: string | undefined): ActiveLivenessChallengeSegment[] {
  if (!raw?.trim()) {
    throw new BadRequestException('Missing liveness challenge metadata.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('Invalid liveness challenge metadata.');
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException('Invalid liveness challenge metadata.');
  }
  return parsed.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    return {
      challenge: record.challenge as ActiveLivenessChallengeSegment['challenge'],
      count: Number(record.count),
    };
  });
}
