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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyOtpUseCase = void 0;
const common_1 = require("@nestjs/common");
const otp_constants_1 = require("../../../common/constants/otp.constants");
const database_transaction_service_1 = require("../../../../prisma/database-transaction.service");
const auth_constants_1 = require("../auth.constants");
const invalid_otp_exception_1 = require("../exceptions/invalid-otp.exception");
const otp_attempts_exceeded_exception_1 = require("../exceptions/otp-attempts-exceeded.exception");
const otp_configuration_exception_1 = require("../exceptions/otp-configuration.exception");
const otp_expired_exception_1 = require("../exceptions/otp-expired.exception");
const otp_alreadyVerified_exception_1 = require("../exceptions/otp-alreadyVerified.exception");
const otp_request_not_found_exception_1 = require("../exceptions/otp-request-not-found.exception");
const otp_repository_1 = require("../repositories/otp.repository");
const otp_type_cache_service_1 = require("../services/otp-type-cache.service");
const customer_auth_service_1 = require("../services/customer-auth.service");
const onboarding_configuration_exception_1 = require("../../onboarding/exceptions/onboarding-configuration.exception");
const complete_onboarding_usecase_1 = require("../../onboarding/use-cases/complete-onboarding.usecase");
let VerifyOtpUseCase = class VerifyOtpUseCase {
    databaseTransactionService;
    otpTypeCacheService;
    otpRepository;
    completeOnboardingUseCase;
    customerAuthService;
    constructor(databaseTransactionService, otpTypeCacheService, otpRepository, completeOnboardingUseCase, customerAuthService) {
        this.databaseTransactionService = databaseTransactionService;
        this.otpTypeCacheService = otpTypeCacheService;
        this.otpRepository = otpRepository;
        this.completeOnboardingUseCase = completeOnboardingUseCase;
        this.customerAuthService = customerAuthService;
    }
    async execute(dto) {
        return this.databaseTransactionService.runInTransaction(async (session) => {
            const now = new Date();
            const otpRequest = await this.otpRepository.findRequestForVerification({
                requestId: dto.requestId
            }, session);
            if (!otpRequest) {
                throw new otp_request_not_found_exception_1.OtpRequestNotFoundException();
            }
            const trackingParams = this.toTrackingParams(otpRequest);
            if (otpRequest.verifiedAt) {
                throw new otp_alreadyVerified_exception_1.OtpAlreadyUsedException();
            }
            if (otpRequest.expiresAt.getTime() <= now.getTime()) {
                throw new otp_expired_exception_1.OtpExpiredException();
            }
            if (otpRequest.attemptCount >= auth_constants_1.OTP_MAX_ATTEMPTS) {
                throw new otp_attempts_exceeded_exception_1.OtpAttemptsExceededException();
            }
            if (otpRequest.otpCode !== dto.otpCode) {
                const nextAttemptCount = otpRequest.attemptCount + 1;
                await this.otpRepository.updateAttemptCount(otpRequest.id, nextAttemptCount, session);
                if (nextAttemptCount >= auth_constants_1.OTP_MAX_ATTEMPTS) {
                    throw new otp_attempts_exceeded_exception_1.OtpAttemptsExceededException();
                }
                throw new invalid_otp_exception_1.InvalidOtpException(auth_constants_1.OTP_MAX_ATTEMPTS - nextAttemptCount);
            }
            const verifiedOtp = await this.otpRepository.markVerified(otpRequest.id, now, session);
            const customer = await this.resolveVerifiedCustomer(dto.type, otpRequest.value, trackingParams, session);
            const token = dto.type === otp_constants_1.OTP_TYPE.MOBILE && customer
                ? await this.customerAuthService.generateToken({
                    uuid: customer.uuid,
                    mobileNumber: customer.mobileNumber
                })
                : undefined;
            return this.buildVerificationResult(verifiedOtp.uuid, verifiedOtp.verifiedAt ?? now, customer, token ?? undefined);
        });
    }
    toTrackingParams(otpRequest) {
        return {
            utmSource: otpRequest.utmSource ?? undefined,
            utmMedium: otpRequest.utmMedium ?? undefined,
            utmCampaign: otpRequest.utmCampaign ?? undefined,
            utmTerm: otpRequest.utmTerm ?? undefined,
            utmContent: otpRequest.utmContent ?? undefined
        };
    }
    async resolveVerifiedCustomer(type, value, trackingParams, session) {
        if (type !== otp_constants_1.OTP_TYPE.MOBILE) {
            return undefined;
        }
        try {
            return await this.completeOnboardingUseCase.execute({
                mobileNumber: value,
                utmParams: trackingParams
            }, session);
        }
        catch (error) {
            if (error instanceof onboarding_configuration_exception_1.OnboardingConfigurationException) {
                throw new otp_configuration_exception_1.OtpConfigurationException(error.resource);
            }
            throw error;
        }
    }
    buildVerificationResult(requestId, verifiedAt, customer, token) {
        return {
            requestId,
            verifiedAt: verifiedAt.toISOString(),
            ...(customer ? { customer } : {}),
            ...(token ? { token } : {})
        };
    }
};
exports.VerifyOtpUseCase = VerifyOtpUseCase;
exports.VerifyOtpUseCase = VerifyOtpUseCase = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_transaction_service_1.DatabaseTransactionService,
        otp_type_cache_service_1.OtpTypeCacheService,
        otp_repository_1.OtpRepository,
        complete_onboarding_usecase_1.CompleteOnboardingUseCase,
        customer_auth_service_1.CustomerAuthService])
], VerifyOtpUseCase);
