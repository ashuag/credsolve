"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const otp_constants_1 = require("../../common/constants/otp.constants");
const send_otp_dto_1 = require("./dto/inputDto/send-otp.dto");
const verify_otp_dto_1 = require("./dto/inputDto/verify-otp.dto");
const get_otp_types_response_dto_1 = require("./dto/outputDto/get-otp-types-response.dto");
const send_otp_response_dto_1 = require("./dto/outputDto/send-otp-response.dto");
const verify_otp_response_dto_1 = require("./dto/outputDto/verify-otp-response.dto");
const customer_auth_service_1 = require("./services/customer-auth.service");
const get_otp_types_usecase_1 = require("./use-cases/get-otp-types.usecase");
const send_otp_usecase_1 = require("./use-cases/send-otp.usecase");
const verify_otp_usecase_1 = require("./use-cases/verify-otp.usecase");
const google_oauth_service_1 = require("./services/google-oauth.service");
let AuthController = class AuthController {
    getOtpTypesUseCase;
    sendOtpUseCase;
    verifyOtpUseCase;
    googleOAuthService;
    customerAuthService;
    constructor(getOtpTypesUseCase, sendOtpUseCase, verifyOtpUseCase, googleOAuthService, customerAuthService) {
        this.getOtpTypesUseCase = getOtpTypesUseCase;
        this.sendOtpUseCase = sendOtpUseCase;
        this.verifyOtpUseCase = verifyOtpUseCase;
        this.googleOAuthService = googleOAuthService;
        this.customerAuthService = customerAuthService;
    }
    googleLogin(mode, leadId) {
        return {
            url: this.googleOAuthService.createAuthorizationUrl(mode === 'login' ? 'login' : 'register', leadId?.trim() || undefined),
            statusCode: 302
        };
    }
    async googleCallback(code, state, error, request, response) {
        if (error) {
            return {
                url: this.googleOAuthService.buildErrorRedirect(this.googleOAuthService.describeProviderError(error)),
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
            return { url: result.redirectUrl, statusCode: 302 };
        }
        catch (callbackError) {
            return {
                url: this.googleOAuthService.buildErrorRedirect(this.googleOAuthService.describeCallbackError(callbackError)),
                statusCode: 302
            };
        }
    }
    getOtpTypes() {
        return this.getOtpTypesUseCase.execute();
    }
    sendOtp(dto, ipAddress) {
        return this.sendOtpUseCase.execute(dto, ipAddress);
    }
    async verifyOtp(dto, response) {
        const verification = await this.verifyOtpUseCase.execute(dto);
        if (dto.type === otp_constants_1.OTP_TYPE.MOBILE && verification.token) {
            this.customerAuthService.setAuthCookie(response, verification.token);
            return this.buildMobileVerificationResponse(verification);
        }
        return this.buildGenericVerificationResponse(verification);
    }
    async getMe(request, response) {
        const auth = await this.customerAuthService.authenticateRequest(request);
        if (!auth.authenticated) {
            if (auth.reason === 'invalid_token') {
                this.customerAuthService.clearAuthCookie(response);
                throw new common_1.BadRequestException({
                    authenticated: false,
                    reason: 'invalid_token'
                });
            }
            return { authenticated: false };
        }
        return {
            authenticated: true,
            customerId: auth.customer.sub,
            mobileNumber: auth.customer.mobileNumber
        };
    }
    logout(response) {
        this.customerAuthService.clearAuthCookie(response);
        return { success: true };
    }
    buildMobileVerificationResponse(verification) {
        return {
            success: true,
            ...(verification.customer?.leadUuid ? { leadId: verification.customer.leadUuid } : {}),
            ...(verification.customer?.leadStatus ? { leadStatus: verification.customer.leadStatus } : {}),
            ...(verification.customer?.uuid ? { customerId: verification.customer.uuid } : {}),
            ...(verification.customer?.mobileNumber ? { mobileNumber: verification.customer.mobileNumber } : {})
        };
    }
    buildGenericVerificationResponse(verification) {
        return {
            requestId: verification.requestId,
            verified: true,
            verifiedAt: verification.verifiedAt,
            ...(verification.customer?.leadUuid ? { leadId: verification.customer.leadUuid } : {}),
            ...(verification.customer ? { customer: verification.customer } : {})
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('google/login'),
    (0, common_1.Redirect)(),
    __param(0, (0, common_1.Query)('mode')),
    __param(1, (0, common_1.Query)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleLogin", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    (0, common_1.Redirect)(),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get supported OTP type values' }),
    (0, swagger_1.ApiOkResponse)({ type: get_otp_types_response_dto_1.GetOtpTypesResponseDto }),
    (0, common_1.Get)('otp-types'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getOtpTypes", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Send OTP for a supported otp type' }),
    (0, swagger_1.ApiBody)({
        type: send_otp_dto_1.SendOtpDto,
        examples: {
            mobile: {
                summary: 'Mobile OTP without UTM values',
                value: { type: otp_constants_1.OTP_TYPE.MOBILE, value: 8882911939 }
            },
            mobileWithUtm: {
                summary: 'Mobile OTP with UTM values',
                value: {
                    type: otp_constants_1.OTP_TYPE.MOBILE,
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
                value: { type: otp_constants_1.OTP_TYPE.EMAIL, value: 'saurabh@moneycach.in' }
            }
        }
    }),
    (0, swagger_1.ApiOkResponse)({ type: send_otp_response_dto_1.SendOtpResponseDto }),
    (0, common_1.Post)('send-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [send_otp_dto_1.SendOtpDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "sendOtp", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Verify OTP for a supported otp type' }),
    (0, swagger_1.ApiOkResponse)({ type: verify_otp_response_dto_1.VerifyOtpResponseDto }),
    (0, common_1.Post)('verify-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyOtp", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get the authenticated customer' }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        authenticated: { type: 'boolean', example: true },
                        customerId: { type: 'string', example: '0f4dd05c-e6b0-4cef-a7fd-1f4cb3f33277' },
                        mobileNumber: { type: 'string', nullable: true, example: '8882911939' }
                    },
                    required: ['authenticated', 'customerId']
                },
                {
                    type: 'object',
                    properties: {
                        authenticated: { type: 'boolean', example: false }
                    },
                    required: ['authenticated']
                }
            ]
        }
    }),
    (0, swagger_1.ApiBadRequestResponse)({
        schema: {
            type: 'object',
            properties: {
                authenticated: { type: 'boolean', example: false },
                reason: { type: 'string', example: 'invalid_token' }
            },
            required: ['authenticated', 'reason']
        }
    }),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Clear the authenticated customer session cookie' }),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [get_otp_types_usecase_1.GetOtpTypesUseCase,
        send_otp_usecase_1.SendOtpUseCase,
        verify_otp_usecase_1.VerifyOtpUseCase,
        google_oauth_service_1.GoogleOAuthService,
        customer_auth_service_1.CustomerAuthService])
], AuthController);
