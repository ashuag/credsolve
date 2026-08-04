import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { VpnBlockGuard } from '../../../common/ip-reputation/vpn-block.guard';
import { readClientIp } from '../../../common/http/client-ip.util';
import { SaveLeadDetailsDto } from '../application/dto/save-lead-details.dto';
import { SaveLeadProfileDto } from '../application/dto/save-lead-profile.dto';
import { SendOtpDto } from '../application/dto/send-otp.dto';
import { VerifyOtpSuccessResponseDto } from '../application/dto/verify-otp-response.dto';
import { VerifyOtpDto } from '../application/dto/verify-otp.dto';
import { SaveLeadReferencesDto } from '../application/dto/save-lead-references.dto';
import { VerifyPanDto } from '../application/dto/verify-pan.dto';
import { GetCustomerSessionUseCase } from '../application/use-cases/get-customer-session.use-case';
import { GetCustomerLoansDashboardUseCase } from '../application/use-cases/get-customer-loans-dashboard.use-case';
import { GetCustomerPaymentHistoryUseCase } from '../application/use-cases/get-customer-payment-history.use-case';
import { InitiateCustomerRepaymentUseCase } from '../application/use-cases/initiate-customer-repayment.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { SendOtpUseCase } from '../application/use-cases/send-otp.use-case';
import { SaveLeadDetailsUseCase } from '../application/use-cases/save-lead-details.use-case';
import { SaveLeadProfileUseCase } from '../application/use-cases/save-lead-profile.use-case';
import { SaveLeadReferencesUseCase } from '../application/use-cases/save-lead-references.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';
import { VerifyPanUseCase } from '../application/use-cases/verify-pan.use-case';
import { RejectPanClientValidationUseCase } from '../application/use-cases/reject-pan-client-validation.use-case';
import { RejectPanClientValidationDto } from '../application/dto/reject-pan-client-validation.dto';
import { InitDigilockerUseCase } from '../application/use-cases/init-digilocker.use-case';
import { DownloadAadhaarDigilockerUseCase } from '../application/use-cases/download-aadhaar-digilocker.use-case';
import { GetPendingDigilockerSessionUseCase } from '../application/use-cases/get-pending-digilocker-session.use-case';
import { ServeDigilockerAadhaarPhotoUseCase } from '../application/use-cases/serve-digilocker-aadhaar-photo.use-case';
import { ServeKycSelfiePhotoUseCase } from '../application/use-cases/serve-kyc-selfie-photo.use-case';
import { GetLoanDocumentsUseCase } from '../application/use-cases/get-loan-documents.use-case';
import { ServeLoanDocumentPdfUseCase } from '../application/use-cases/serve-loan-document-pdf.use-case';
import { SendLoanDocumentsOtpUseCase } from '../application/use-cases/send-loan-documents-otp.use-case';
import { AcceptLoanDocumentsUseCase } from '../application/use-cases/accept-loan-documents.use-case';
import { AcknowledgeLoanDocumentsUseCase } from '../application/use-cases/acknowledge-loan-documents.use-case';
import { AcceptLoanDocumentsDto } from '../application/dto/accept-loan-documents.dto';
import { InitDigilockerDto } from '../application/dto/init-digilocker.dto';
import { DownloadAadhaarDigilockerDto } from '../application/dto/download-aadhaar-digilocker.dto';
import { buildCustomerAuthCookieOptions } from '../infrastructure/session/customer-auth-cookie.util';
import { CustomerGoogleOauthService } from '../infrastructure/google/customer-google-oauth.service';
import { OptionalCustomerSessionGuard } from './guards/optional-customer-session.guard';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('auth')
@Controller('auth')
@UseGuards(RedisIpRateLimitGuard, VpnBlockGuard, OptionalCustomerSessionGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly sendOtpFlow: SendOtpUseCase,
    private readonly verifyOtpFlow: VerifyOtpUseCase,
    private readonly customerSession: GetCustomerSessionUseCase,
    private readonly customerLoansDashboard: GetCustomerLoansDashboardUseCase,
    private readonly customerPaymentHistory: GetCustomerPaymentHistoryUseCase,
    private readonly initiateCustomerRepayment: InitiateCustomerRepaymentUseCase,
    private readonly logoutFlow: LogoutUseCase,
    private readonly customerGoogleOauth: CustomerGoogleOauthService,
    private readonly saveLeadDetailsFlow: SaveLeadDetailsUseCase,
    private readonly saveLeadProfileFlow: SaveLeadProfileUseCase,
    private readonly saveLeadReferencesFlow: SaveLeadReferencesUseCase,
    private readonly verifyPanFlow: VerifyPanUseCase,
    private readonly rejectPanClientValidationFlow: RejectPanClientValidationUseCase,
    private readonly initDigilockerFlow: InitDigilockerUseCase,
    private readonly downloadAadhaarDigilockerFlow: DownloadAadhaarDigilockerUseCase,
    private readonly getPendingDigilockerSessionFlow: GetPendingDigilockerSessionUseCase,
    private readonly serveDigilockerAadhaarPhotoFlow: ServeDigilockerAadhaarPhotoUseCase,
    private readonly serveKycSelfiePhotoFlow: ServeKycSelfiePhotoUseCase,
    private readonly getLoanDocumentsFlow: GetLoanDocumentsUseCase,
    private readonly serveLoanDocumentPdfFlow: ServeLoanDocumentPdfUseCase,
    private readonly sendLoanDocumentsOtpFlow: SendLoanDocumentsOtpUseCase,
    private readonly acceptLoanDocumentsFlow: AcceptLoanDocumentsUseCase,
    private readonly acknowledgeLoanDocumentsFlow: AcknowledgeLoanDocumentsUseCase,
  ) {}

  @Post('send-otp')
  @RateLimitByRoute('send-otp')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send OTP to mobile or email (email requires an existing mobile session)' })
  sendOtpRoute(@Body() body: SendOtpDto, @Req() req: Request) {
    return this.sendOtpFlow.execute(body, readClientIp(req), req.customerSession);
  }

  @Post('verify-otp')
  @RateLimitByRoute('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP for mobile (creates Redis session + Set-Cookie) or email (updates lead email)',
    description:
      'On success, the JSON body always includes `success`, `requestId`, `verified`, and `verifiedAt`. ' +
      'Mobile verification also returns `customerId`, `mobileNumber`, `leadId`, and `leadStatus`. ' +
      'The session identifier is only sent as an HttpOnly `Set-Cookie` (opaque id), never in this JSON body.',
  })
  @ApiOkResponse({
    type: VerifyOtpSuccessResponseDto,
    headers: {
      'Set-Cookie': {
        description:
          'After mobile OTP: HttpOnly cookie (e.g. `mc_sid=<opaque>`) with the Redis-backed session id. Not sent for email-only OTP.',
        schema: { type: 'string' },
      },
    },
  })
  async verifyOtpRoute(
    @Body() body: VerifyOtpDto, 
    @Req() req: Request, 
    @Res({ passthrough: true }) res: Response
  ) {
    const out = await this.verifyOtpFlow.execute(body, req.customerSession, {
      ip: readClientIp(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    const { sessionCookie, ...rest } = out;
    if (sessionCookie) {
      res.cookie(sessionCookie.name, sessionCookie.sessionId, buildCustomerAuthCookieOptions(sessionCookie.maxAgeMs));
    }
    const bodyJson: VerifyOtpSuccessResponseDto = {
      success: rest.success,
      requestId: rest.requestId,
      verified: rest.verified,
      verifiedAt: rest.verifiedAt,
      customerId: rest.customerId,
      mobileNumber: rest.mobileNumber,
      leadId: rest.leadId ?? undefined,
      leadStatus: rest.leadStatus ?? undefined,
    };
    return bodyJson;
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the current customer session if the auth cookie is valid' })
  me(@Req() req: Request) {
    return this.customerSession.execute(req);
  }

  @Get('kyc/digilocker-aadhaar-photo')
  @UseGuards(RequiredCustomerSessionGuard)
  @ApiOperation({
    summary: 'Stream Aadhaar photo saved after DigiLocker download (requires session cookie)',
  })
  async digilockerAadhaarPhoto(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.serveDigilockerAadhaarPhotoFlow.execute(req, res);
  }

  @Get('kyc/selfie-photo')
  @UseGuards(RequiredCustomerSessionGuard)
  @ApiOperation({
    summary: 'Stream the selfie JPEG saved for the active application (requires session cookie)',
  })
  async kycSelfiePhoto(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.serveKycSelfiePhotoFlow.execute(req, res);
  }

  @Get('loan-documents')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('loan-documents')
  @ApiOperation({
    summary: 'List pre-KYC loan PDFs (generates personalized copies in Spaces or storage/customer when missing)',
  })
  loanDocumentsRoute(@Req() req: Request) {
    return this.getLoanDocumentsFlow.execute(req);
  }

  @Get('loan-documents/:docType/pdf')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('loan-documents')
  @ApiOperation({
    summary: 'Stream Key Fact Statement or Loan Agreement PDF (requires session cookie)',
  })
  async loanDocumentPdfRoute(
    @Req() req: Request,
    @Res() res: Response,
    @Param('docType') docType: string,
  ): Promise<void> {
    await this.serveLoanDocumentPdfFlow.execute(req, res, docType);
  }

  @Post('loan-documents/acknowledge')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('loan-documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record loan-document review agreement (no OTP; continues to KYC)',
  })
  acknowledgeLoanDocumentsRoute(@Req() req: Request) {
    return this.acknowledgeLoanDocumentsFlow.execute(req);
  }

  @Post('loan-documents/send-otp')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('loan-documents-otp')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send mobile OTP after references to accept sanctioned letter' })
  sendLoanDocumentsOtpRoute(@Req() req: Request) {
    return this.sendLoanDocumentsOtpFlow.execute(req);
  }

  @Post('loan-documents/accept')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('loan-documents-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify mobile OTP after references; email signed sanctioned letter',
  })
  acceptLoanDocumentsRoute(@Req() req: Request, @Body() body: AcceptLoanDocumentsDto) {
    return this.acceptLoanDocumentsFlow.execute(req, body);
  }

  @Get('my-loans')
  @UseGuards(RequiredCustomerSessionGuard)
  @ApiOperation({
    summary: 'Dashboard data: active loans, past loans, in-flight applications, repayment lines',
  })
  myLoans(@Req() req: Request) {
    return this.customerLoansDashboard.execute(req);
  }

  @Post('my-loans/:applicationUuid/repay')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('loan-repay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Collect loan repayment via Easebuzz EasyCollect (principal + interest till today). Returns a payment URL; loan closes after successful payment.',
  })
  repayLoan(@Req() req: Request, @Param('applicationUuid') applicationUuid: string) {
    return this.initiateCustomerRepayment.execute(req, applicationUuid);
  }

  @Get('my-payments')
  @UseGuards(RequiredCustomerSessionGuard)
  @ApiOperation({ summary: 'Customer repayment history (successful and failed attempts)' })
  myPayments(@Req() req: Request) {
    return this.customerPaymentHistory.execute(req);
  }

  @Get('google/login')
  @UseGuards(RequiredCustomerSessionGuard)
  @ApiOperation({
    summary: 'Start Google OAuth for customer email verification (requires mobile session cookie)',
  })
  googleLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('mode') mode?: string,
    @Query('leadId') leadId?: string
  ): void {
    const url = this.customerGoogleOauth.buildAuthorizationUrl(req, mode, leadId);
    res.redirect(302, url);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth redirect target; updates lead email then redirects to the customer SPA' })
  async googleCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') googleError?: string
  ): Promise<void> {
    const redirectUrl = await this.customerGoogleOauth.completeOAuthRedirect(code, state, googleError);
    res.redirect(302, redirectUrl);
  }

  @Post('logout')
  @RateLimitByRoute('logout')
  @ApiOperation({ summary: 'Revoke server-side session and clear the auth cookie' })
  logoutRoute(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.logoutFlow.execute(req, res);
  }

  /**
   * Alias for `POST /api/leads/details` (same handler). Prefer this path when a proxy strips
   * non-`auth` API segments or an older gateway only forwards `/api/auth/*`.
   */
  @Post('lead-details')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('save-lead-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save onboarding lead details (alias of POST /leads/details)' })
  saveLeadDetailsAlias(@Req() req: Request, @Body() body: SaveLeadDetailsDto) {
    return this.saveLeadDetailsFlow.execute(req, body);
  }

  @Post('lead-profile')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('save-lead-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save basic profile fields before the address step (no PAN/CIBIL yet)' })
  saveLeadProfileRoute(@Req() req: Request, @Body() body: SaveLeadProfileDto) {
    return this.saveLeadProfileFlow.execute(req, body);
  }

  @Post('verify-pan')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('verify-pan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Save full profile, run pre-BRE, then PAN-NSDL and bureau soft-pull when checks pass',
  })
  verifyPanRoute(@Req() req: Request, @Body() body: VerifyPanDto) {
    const pan = body.panNumber?.trim().toUpperCase() ?? '';
    const panTail = pan.length >= 4 ? pan.slice(-4) : '????';
    this.logger.log(
      `POST /api/auth/verify-pan ip=${readClientIp(req) ?? 'unknown'} leadUuid=${body.leadUuid ?? '(active lead)'} pan=******${panTail}`,
    );
    
    return this.verifyPanFlow.execute(req, body);
  }

  @Post('reject-pan-client-validation')
  @UseGuards(RequiredCustomerSessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject lead when client-side PAN name validation fails on second attempt' })
  rejectPanClientValidationRoute(@Req() req: Request, @Body() body: RejectPanClientValidationDto) {
    return this.rejectPanClientValidationFlow.execute(req, body);
  }

  @Post('lead-references')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('save-lead-references')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save two personal references after bank details' })
  saveLeadReferencesRoute(@Req() req: Request, @Body() body: SaveLeadReferencesDto) {
    return this.saveLeadReferencesFlow.execute(req, body);
  }

  @Post('digilocker/init')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('digilocker-init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start Tenacio DigiLocker workflow (audited vendor call; requires mobile session cookie)',
  })
  initDigilockerRoute(@Req() req: Request, @Body() body: InitDigilockerDto) {
    this.logger.log(`POST /api/auth/digilocker/init ip=${readClientIp(req) ?? 'unknown'}`);
    return this.initDigilockerFlow.execute(req, body);
  }

  @Get('digilocker/pending-session')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('digilocker-aadhaar')
  @ApiOperation({
    summary:
      'Recover DigiLocker sessionToken saved at init (for /kyc/digilocker-callback when browser storage is empty)',
  })
  getPendingDigilockerSessionRoute(@Req() req: Request) {
    return this.getPendingDigilockerSessionFlow.execute(req);
  }

  @Post('digilocker/download-aadhaar')
  @UseGuards(RequiredCustomerSessionGuard)
  @RateLimitByRoute('digilocker-aadhaar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Download Aadhaar XML/KYC data from Tenacio after DigiLocker (sessionToken from generate-URL response)',
  })
  downloadAadhaarDigilockerRoute(@Req() req: Request, @Body() body: DownloadAadhaarDigilockerDto) {
    this.logger.log(`POST /api/auth/digilocker/download-aadhaar ip=${readClientIp(req) ?? 'unknown'}`);
    return this.downloadAadhaarDigilockerFlow.execute(req, body);
  }
}
