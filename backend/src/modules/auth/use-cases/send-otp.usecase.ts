import {Injectable, BadRequestException, Logger} from '@nestjs/common';
import {OTP_TYPE, type OtpType} from '../../../common/constants/otp.constants';
import {DatabaseTransactionService} from '../../../../prisma/database-transaction.service';
import {type DatabaseSession} from '../../../../prisma/database-session';
import {SendOtpDto} from '../dto/inputDto/send-otp.dto';
import {SendOtpResponseDto} from '../dto/outputDto/send-otp-response.dto';
import {
    OTP_EXPIRY_SECONDS,
    OTP_MAX_REQUESTS_PER_WINDOW,
    OTP_RATE_LIMIT_WINDOW_SECONDS,
    OTP_RESEND_AFTER_SECONDS
} from '../auth.constants';
import {OtpConfigurationException} from '../exceptions/otp-configuration.exception';
import {OtpRateLimitedException} from '../exceptions/otp-rate-limited.exception';
import {OtpResendTooSoonException} from '../exceptions/otp-resend-too-soon.exception';
import {OtpRepository} from '../repositories/otp.repository';
import {OtpEmailService} from '../services/otp-email.service';
import {OtpIssuerService} from '../services/otp-issuer.service';
import {OtpTypeCacheService} from '../services/otp-type-cache.service';
import {type OtpIssueParams} from '../auth.types';
import { warnWithError, logMessage } from '../../../common/logging/logger.utils';

type OtpIssuePayload = OtpIssueParams & { ipAddress: string };

@Injectable()
export class SendOtpUseCase {
    private readonly logger = new Logger(SendOtpUseCase.name);

    constructor(
        private readonly databaseTransactionService: DatabaseTransactionService,
        private readonly otpTypeCacheService: OtpTypeCacheService,
        private readonly otpRepository: OtpRepository,
        private readonly otpIssuerService: OtpIssuerService,
        private readonly otpEmailService: OtpEmailService
    ) {
    }

    async execute(dto: SendOtpDto, ipAddress?: string): Promise<SendOtpResponseDto> {
        const otpTypeId = await this.requireActiveOtpTypeId(dto.type);
        const payload = this.requireIpAddress(this.otpIssuerService.prepareSendOtpPayload(dto, ipAddress));

        const issuedOtp = await this.databaseTransactionService.runInTransaction(
            async (session) => {
                const now = new Date();
                await this.enforceRateLimit(payload, otpTypeId, now, session);
                await this.enforceResendCooldown(payload, otpTypeId, now, session);
                return this.issueOtpRequest(payload, otpTypeId, now, session);
            }
        );

        logMessage(this.logger, issuedOtp);

        await this.deliverOtp(dto.type, payload.value, issuedOtp);

        return issuedOtp.response;
    }

    private requireIpAddress(payload: OtpIssueParams): OtpIssuePayload {
        if (!payload.ipAddress) {
            throw new BadRequestException('Unable to process request');
        }

        return {...payload, ipAddress: payload.ipAddress};
    }

    private async enforceRateLimit(
        payload: OtpIssuePayload,
        otpTypeId: number,
        now: Date,
        session: DatabaseSession
    ): Promise<void> {
        const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_SECONDS * 1000);
        const {count: recentOtpCount, oldestAt} = await this.otpRepository.getRecentRequestWindowStats({
            value: payload.value,
            typeId: otpTypeId,
            ipAddress: payload.ipAddress,
            windowStart
        }, session);

        if (recentOtpCount < OTP_MAX_REQUESTS_PER_WINDOW) {
            return;
        }

        const retryAfterSeconds = oldestAt
            ? Math.max(0, Math.ceil((oldestAt.getTime() + OTP_RATE_LIMIT_WINDOW_SECONDS * 1000 - now.getTime()) / 1000))
            : OTP_RATE_LIMIT_WINDOW_SECONDS;

        throw new OtpRateLimitedException(retryAfterSeconds);
    }

    private async enforceResendCooldown(
        payload: OtpIssuePayload,
        otpTypeId: number,
        now: Date,
        session: DatabaseSession
    ): Promise<void> {
        const latestActiveRequest = await this.otpRepository.findLatestActiveRequest({
            value: payload.value,
            typeId: otpTypeId,
            now
        }, session);

        if (!latestActiveRequest) {
            return;
        }

        const resendUnlockedAt = latestActiveRequest.lastSentAt.getTime() + OTP_RESEND_AFTER_SECONDS * 1000;
        const retryAfterSeconds = Math.max(0, Math.ceil((resendUnlockedAt - now.getTime()) / 1000));

        if (retryAfterSeconds > 0) {
            throw new OtpResendTooSoonException();
        }
    }

    private async issueOtpRequest(
        payload: OtpIssuePayload,
        otpTypeId: number,
        now: Date,
        session: DatabaseSession
    ) {
        const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_AFTER_SECONDS * 1000);
        const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);
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
                resendAfterSeconds: OTP_RESEND_AFTER_SECONDS,
                resendAvailableAt: resendAvailableAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                ...(this.otpIssuerService.shouldExposeDebugOtp() ? {debugOtp: otpCode} : {})
            }
        };
    }

    private async deliverOtp(
        type: OtpType,
        value: string,
        issuedOtp: { otpRequestId: number; otpCode: string }
    ): Promise<void> {
        if (type !== OTP_TYPE.EMAIL) {
            return;
        }

        try {
            await this.otpEmailService.sendOtpEmail(value, issuedOtp.otpCode);
        } catch (error) {
            await this.otpRepository.deletePendingRequest(issuedOtp.otpRequestId)
                .catch((err: Error) => warnWithError(this.logger, 'Failed to delete pending OTP request', err));
            throw error;
        }
    }

    private async requireActiveOtpTypeId(type: OtpType): Promise<number> {
        const otpTypeId = await this.otpTypeCacheService.getOtpTypeId(type);

        if (!otpTypeId) {
            throw new OtpConfigurationException(`${type} otp type`);
        }

        return otpTypeId;
    }
}
