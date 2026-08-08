import { Body, Controller, HttpCode, HttpStatus, Post, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
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
import { SaveKycLivenessVideoUseCase } from '../application/use-cases/save-kyc-liveness-video.use-case';
import { RunKycLivenessUseCase } from '../application/use-cases/run-kyc-liveness.use-case';
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
    private readonly saveKycLivenessVideo: SaveKycLivenessVideoUseCase,
    private readonly runKycLiveness: RunKycLivenessUseCase,
    private readonly saveBankDetails: SaveBankDetailsUseCase,
    private readonly lookupIfsc: LookupIfscUseCase,
    private readonly submitVerifiedBank: SubmitVerifiedBankUseCase,
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
    }),
  )
  @ApiOperation({ summary: 'Save KYC numbers + uploaded Aadhaar front/back images' })
  @ApiOkResponse({ description: 'KYC document references stored' })
  kycDocumentsRoute(@Req() req: Request, @UploadedFiles() files: Array<UploadedFileLike>) {
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
  })
  @ApiOkResponse({ description: 'Selfie stored under customer UUID / selfie / application UUID' })
  kycSelfieRoute(@Req() req: Request, @UploadedFile() selfie: UploadedFileLike | undefined) {
    return this.saveKycSelfie.execute(req, selfie);
  }

  @Post('kyc/liveness-video')
  @RateLimitByRoute('kyc-liveness-video')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: 12 * 1024 * 1024, files: 25 },
    }),
  )
  @ApiOperation({
    summary:
      'Store the active-liveness head-movement recording and score head pose across the JPEG frames sampled from the same capture.',
  })
  @ApiOkResponse({ description: 'Head-movement score persisted on the application; video stored as an audit artifact' })
  kycLivenessVideoRoute(@Req() req: Request, @UploadedFiles() files: Array<UploadedFileLike>) {
    return this.saveKycLivenessVideo.execute(req, files ?? []);
  }

  @Post('kyc/liveness')
  @RateLimitByRoute('kyc-liveness')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Run MoneyCash local KYC checks (selfie face validation, Aadhaar face match, authenticity), then Tenacio liveness on the stored selfie URL when outbound is enabled.',
  })
  @ApiOkResponse({ description: 'Vendor outcome; updates application when HTTP call completes' })
  kycLivenessRoute(@Req() req: Request) {
    return this.runKycLiveness.execute(req);
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
