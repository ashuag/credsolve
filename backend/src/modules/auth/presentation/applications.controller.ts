import { Body, Controller, HttpCode, HttpStatus, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../common/types/uploaded-file';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { SaveBankDetailsDto } from '../application/dto/save-bank-details.dto';
import { SaveLoanSelectionDto } from '../application/dto/save-loan-selection.dto';
import { SaveBankDetailsUseCase } from '../application/use-cases/save-bank-details.use-case';
import { SaveKycDocumentsUseCase } from '../application/use-cases/save-kyc-documents.use-case';
import { SaveLoanSelectionUseCase } from '../application/use-cases/save-loan-selection.use-case';
import { SaveProfessionalDetailsDto } from '../application/dto/save-professional-details.dto';
import { SubmitProfessionalApplicationUseCase } from '../application/use-cases/submit-professional-application.use-case';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('applications')
@Controller('applications')
@UseGuards(RedisIpRateLimitGuard, RequiredCustomerSessionGuard)
export class ApplicationsController {
  constructor(
    private readonly submitProfessionalApplication: SubmitProfessionalApplicationUseCase,
    private readonly saveLoanSelection: SaveLoanSelectionUseCase,
    private readonly saveKycDocuments: SaveKycDocumentsUseCase,
    private readonly saveBankDetails: SaveBankDetailsUseCase
  ) {}

  @Post('professional-details')
  @RateLimitByRoute('professional-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Save professional / income fields, run eligibility, store approved amount, set lead to CONVERTED',
  })
  @ApiOkResponse({
    description: 'Eligibility outcome; approvedAmount/cibilScore when eligible',
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

  @Post('bank-details')
  @RateLimitByRoute('bank-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save customer bank details for disbursement' })
  @ApiOkResponse({ description: 'Bank details saved' })
  bankDetailsRoute(@Req() req: Request, @Body() body: SaveBankDetailsDto) {
    return this.saveBankDetails.execute(req, body);
  }
}
