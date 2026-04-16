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
var SendOtpUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendOtpUseCase = void 0;
const common_1 = require("@nestjs/common");
const otp_constants_1 = require("../../../common/constants/otp.constants");
const database_transaction_service_1 = require("../../../../prisma/database-transaction.service");
const auth_constants_1 = require("../auth.constants");
const otp_configuration_exception_1 = require("../exceptions/otp-configuration.exception");
const otp_rate_limited_exception_1 = require("../exceptions/otp-rate-limited.exception");
const otp_resend_too_soon_exception_1 = require("../exceptions/otp-resend-too-soon.exception");
const otp_repository_1 = require("../repositories/otp.repository");
const otp_email_service_1 = require("../services/otp-email.service");
const otp_issuer_service_1 = require("../services/otp-issuer.service");
const otp_type_cache_service_1 = require("../services/otp-type-cache.service");
const logger_utils_1 = require("../../../common/logging/logger.utils");
let SendOtpUseCase = SendOtpUseCase_1 = class SendOtpUseCase {
    databaseTransactionService;
    otpTypeCacheService;
    otpRepository;
    otpIssuerService;
    otpEmailService;
    logger = new common_1.Logger(SendOtpUseCase_1.name);
    constructor(databaseTransactionService, otpTypeCacheService, otpRepository, otpIssuerService, otpEmailService) {
        this.databaseTransactionService = databaseTransactionService;
        this.otpTypeCacheService = otpTypeCacheService;
        this.otpRepository = otpRepository;
        this.otpIssuerService = otpIssuerService;
        this.otpEmailService = otpEmailService;
    }
    async execute(dto, ipAddress) {
        const otpTypeId = await this.requireActiveOtpTypeId(dto.type);
        const payload = this.requireIpAddress(this.otpIssuerService.prepareSendOtpPayload(dto, ipAddress));
        const issuedOtp = await this.databaseTransactionService.runInTransaction(async (session) => {
            const now = new Date();
            await this.enforceRateLimit(payload, otpTypeId, now, session);
            await this.enforceResendCooldown(payload, otpTypeId, now, session);
            return this.issueOtpRequest(payload, otpTypeId, now, session);
        });
        (0, logger_utils_1.logMessage)(this.logger, issuedOtp);
        await this.deliverOtp(dto.type, payload.value, issuedOtp);
        return issuedOtp.response;
    }
    requireIpAddress(payload) {
        if (!payload.ipAddress) {
            throw new common_1.BadRequestException('Unable to process request');
        }
        return { ...payload, ipAddress: payload.ipAddress };
    }
    async enforceRateLimit(payload, otpTypeId, now, session) {
        const windowStart = new Date(now.getTime() - auth_constants_1.OTP_RATE_LIMIT_WINDOW_SECONDS * 1000);
        const { count: recentOtpCount, oldestAt } = await this.otpRepository.getRecentRequestWindowStats({
            value: payload.value,
            typeId: otpTypeId,
            ipAddress: payload.ipAddress,
            windowStart
        }, session);
        if (recentOtpCount < auth_constants_1.OTP_MAX_REQUESTS_PER_WINDOW) {
            return;
        }
        const retryAfterSeconds = oldestAt
            ? Math.max(0, Math.ceil((oldestAt.getTime() + auth_constants_1.OTP_RATE_LIMIT_WINDOW_SECONDS * 1000 - now.getTime()) / 1000))
            : auth_constants_1.OTP_RATE_LIMIT_WINDOW_SECONDS;
        throw new otp_rate_limited_exception_1.OtpRateLimitedException(retryAfterSeconds);
    }
    async enforceResendCooldown(payload, otpTypeId, now, session) {
        const latestActiveRequest = await this.otpRepository.findLatestActiveRequest({
            value: payload.value,
            typeId: otpTypeId,
            now
        }, session);
        if (!latestActiveRequest) {
            return;
        }
        const resendUnlockedAt = latestActiveRequest.lastSentAt.getTime() + auth_constants_1.OTP_RESEND_AFTER_SECONDS * 1000;
        const retryAfterSeconds = Math.max(0, Math.ceil((resendUnlockedAt - now.getTime()) / 1000));
        if (retryAfterSeconds > 0) {
            throw new otp_resend_too_soon_exception_1.OtpResendTooSoonException();
        }
    }
    async issueOtpRequest(payload, otpTypeId, now, session) {
        const resendAvailableAt = new Date(now.getTime() + auth_constants_1.OTP_RESEND_AFTER_SECONDS * 1000);
        const expiresAt = new Date(now.getTime() + auth_constants_1.OTP_EXPIRY_SECONDS * 1000);
        const otpCode = this.otpIssuerService.generateOtpCode();
        const otpRequest = await this.otpRepository.createOtpRequest({
            value: payload.value,
            typeId: otpTypeId,
            otpCode,
            expiresAt,
            ipAddress: payload.ipAddress,
            utmParams: {
                utmSource: payload.utmSource,
                utmMedium: payload.utmMedium,
                utmCampaign: payload.utmCampaign,
                utmTerm: payload.utmTerm,
                utmContent: payload.utmContent
            }
        }, session);
        return {
            otpRequestId: otpRequest.id,
            otpCode,
            response: {
                requestId: otpRequest.uuid,
                maskedValue: payload.maskedValue,
                resendAfterSeconds: auth_constants_1.OTP_RESEND_AFTER_SECONDS,
                resendAvailableAt: resendAvailableAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                ...(this.otpIssuerService.shouldExposeDebugOtp() ? { debugOtp: otpCode } : {})
            }
        };
    }
    async deliverOtp(type, value, issuedOtp) {
        if (type !== otp_constants_1.OTP_TYPE.EMAIL) {
            return;
        }
        try {
            await this.otpEmailService.sendOtpEmail(value, issuedOtp.otpCode);
        }
        catch (error) {
            await this.otpRepository.deletePendingRequest(issuedOtp.otpRequestId)
                .catch((err) => (0, logger_utils_1.warnWithError)(this.logger, 'Failed to delete pending OTP request', err));
            throw error;
        }
    }
    async requireActiveOtpTypeId(type) {
        const otpTypeId = await this.otpTypeCacheService.getOtpTypeId(type);
        if (!otpTypeId) {
            throw new otp_configuration_exception_1.OtpConfigurationException(`${type} otp type`);
        }
        return otpTypeId;
    }
};
exports.SendOtpUseCase = SendOtpUseCase;
exports.SendOtpUseCase = SendOtpUseCase = SendOtpUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_transaction_service_1.DatabaseTransactionService,
        otp_type_cache_service_1.OtpTypeCacheService,
        otp_repository_1.OtpRepository,
        otp_issuer_service_1.OtpIssuerService,
        otp_email_service_1.OtpEmailService])
], SendOtpUseCase);
