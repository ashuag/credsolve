import {BadRequestException, Body, Controller, Get, Ip, Post, Query, Redirect, Req, Res} from '@nestjs/common';
import {ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request, Response} from 'express';
import {OTP_TYPE} from '../../common/constants/otp.constants';
import {SendOtpDto} from './dto/inputDto/send-otp.dto';
import {VerifyOtpDto} from './dto/inputDto/verify-otp.dto';
import {GetOtpTypesResponseDto} from './dto/outputDto/get-otp-types-response.dto';
import {SendOtpResponseDto} from './dto/outputDto/send-otp-response.dto';
import {VerifyOtpResponseDto} from './dto/outputDto/verify-otp-response.dto';
import {CustomerAuthService} from './services/customer-auth.service';
import {GetOtpTypesUseCase} from './use-cases/get-otp-types.usecase';
import {SendOtpUseCase} from './use-cases/send-otp.usecase';
import {VerifyOtpUseCase, type VerifyOtpResult} from './use-cases/verify-otp.usecase';
import {GoogleOAuthService} from './services/google-oauth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly getOtpTypesUseCase: GetOtpTypesUseCase,
        private readonly sendOtpUseCase: SendOtpUseCase,
        private readonly verifyOtpUseCase: VerifyOtpUseCase,
        private readonly googleOAuthService: GoogleOAuthService,
        private readonly customerAuthService: CustomerAuthService
    ) {
    }

    @Get('google/login')
    @Redirect()
    googleLogin(
        @Query('mode') mode: string | undefined,
        @Query('leadId') leadId: string | undefined
    ) {
        return {
            url: this.googleOAuthService.createAuthorizationUrl(
                mode === 'login' ? 'login' : 'register',
                leadId?.trim() || undefined
            ),
            statusCode: 302
        };
    }

    @Get('google/callback')
    @Redirect()
    async googleCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Query('error') error: string | undefined,
        @Req() request: Request,
        @Res({passthrough: true}) response: Response
    ) {
        if (error) {
            return {
                url: this.googleOAuthService.buildErrorRedirect(
                    this.googleOAuthService.describeProviderError(error)
                ),
                statusCode: 302
            };
        }

        if (!code) {
            return {
                url: this.googleOAuthService.buildErrorRedirect('Google login could not be completed.'),
                statusCode: 302
            };
        }

        try {
            const result = await this.googleOAuthService.buildSuccessRedirect(code, state);
            const auth = await this.customerAuthService.authenticateRequest(request);

            if (!auth.authenticated) {
                this.customerAuthService.setAuthCookie(response, result.token);
            }

            return {url: result.redirectUrl, statusCode: 302};
        } catch (callbackError) {
            return {
                url: this.googleOAuthService.buildErrorRedirect(
                    this.googleOAuthService.describeCallbackError(callbackError)
                ),
                statusCode: 302
            };
        }
    }

    @ApiOperation({summary: 'Get supported OTP type values'})
    @ApiOkResponse({type: GetOtpTypesResponseDto})
    @Get('otp-types')
    getOtpTypes() {
        return this.getOtpTypesUseCase.execute();
    }

    @ApiOperation({summary: 'Send OTP for a supported otp type'})
    @ApiBody({
        type: SendOtpDto,
        examples: {
            mobile: {
                summary: 'Mobile OTP without UTM values',
                value: {type: OTP_TYPE.MOBILE, value: 8882911939}
            },
            mobileWithUtm: {
                summary: 'Mobile OTP with UTM values',
                value: {
                    type: OTP_TYPE.MOBILE,
                    value: 8882911939,
                    utmSource: 'google',
                    utmMedium: 'cpc',
                    utmCampaign: 'summer-offer',
                    utmTerm: 'instant-loan',
                    utmContent: 'hero-banner'
                }
            },
            email: {
                summary: 'Email OTP',
                value: {type: OTP_TYPE.EMAIL, value: 'saurabh@moneycach.in'}
            }
        }
    })
    @ApiOkResponse({type: SendOtpResponseDto})
    @Post('send-otp')
    sendOtp(@Body() dto: SendOtpDto, @Ip() ipAddress: string) {
        return this.sendOtpUseCase.execute(dto, ipAddress);
    }

    @ApiOperation({summary: 'Verify OTP for a supported otp type'})
    @ApiOkResponse({type: VerifyOtpResponseDto})
    @Post('verify-otp')
    async verifyOtp(
        @Body() dto: VerifyOtpDto,
        @Res({passthrough: true}) response: Response
    ): Promise<VerifyOtpResponseDto> {
        const verification = await this.verifyOtpUseCase.execute(dto);

        if (dto.type === OTP_TYPE.MOBILE && verification.token) {
            this.customerAuthService.setAuthCookie(response, verification.token);
            return this.buildMobileVerificationResponse(verification);
        }

        return this.buildGenericVerificationResponse(verification);
    }

    @ApiOperation({summary: 'Get the authenticated customer'})
    @ApiOkResponse({
        schema: {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        authenticated: {type: 'boolean', example: true},
                        customerId: {type: 'string', example: '0f4dd05c-e6b0-4cef-a7fd-1f4cb3f33277'},
                        mobileNumber: {type: 'string', nullable: true, example: '8882911939'}
                    },
                    required: ['authenticated', 'customerId']
                },
                {
                    type: 'object',
                    properties: {
                        authenticated: {type: 'boolean', example: false}
                    },
                    required: ['authenticated']
                }
            ]
        }
    })
    @ApiBadRequestResponse({
        schema: {
            type: 'object',
            properties: {
                authenticated: {type: 'boolean', example: false},
                reason: {type: 'string', example: 'invalid_token'}
            },
            required: ['authenticated', 'reason']
        }
    })
    @Get('me')
    async getMe(
        @Req() request: Request,
        @Res({passthrough: true}) response: Response
    ) {
        const auth = await this.customerAuthService.authenticateRequest(request);

        if (!auth.authenticated) {
            if (auth.reason === 'invalid_token') {
                this.customerAuthService.clearAuthCookie(response);
                throw new BadRequestException({
                    authenticated: false,
                    reason: 'invalid_token' as const
                });
            }

            return {authenticated: false};
        }

        return {
            authenticated: true,
            customerId: auth.customer.sub,
            mobileNumber: auth.customer.mobileNumber
        };
    }

    @ApiOperation({summary: 'Clear the authenticated customer session cookie'})
    @Post('logout')
    logout(@Res({passthrough: true}) response: Response) {
        this.customerAuthService.clearAuthCookie(response);

        return {success: true};
    }

    private buildMobileVerificationResponse(verification: VerifyOtpResult): VerifyOtpResponseDto {
        return {
            success: true,
            ...(verification.customer?.leadUuid ? {leadId: verification.customer.leadUuid} : {}),
            ...(verification.customer?.leadStatus ? {leadStatus: verification.customer.leadStatus} : {}),
            ...(verification.customer?.uuid ? {customerId: verification.customer.uuid} : {}),
            ...(verification.customer?.mobileNumber ? {mobileNumber: verification.customer.mobileNumber} : {})
        };
    }

    private buildGenericVerificationResponse(verification: VerifyOtpResult): VerifyOtpResponseDto {
        return {
            requestId: verification.requestId,
            verified: true,
            verifiedAt: verification.verifiedAt,
            ...(verification.customer?.leadUuid ? {leadId: verification.customer.leadUuid} : {}),
            ...(verification.customer ? {customer: verification.customer} : {})
        };
    }
}
