import {Injectable} from '@nestjs/common';
import {OTP_TYPE, type OtpType} from '../../../common/constants/otp.constants';
import {type UtmTrackingParams} from '../../../common/types/utm-tracking.types';
import {type DatabaseSession} from '../../../../prisma/database-session';
import {DatabaseTransactionService} from '../../../../prisma/database-transaction.service';
import {VerifyOtpDto} from '../dto/inputDto/verify-otp.dto';
import {OTP_MAX_ATTEMPTS} from '../auth.constants';
import {InvalidOtpException} from '../exceptions/invalid-otp.exception';
import {OtpAttemptsExceededException} from '../exceptions/otp-attempts-exceeded.exception';
import {OtpConfigurationException} from '../exceptions/otp-configuration.exception';
import {OtpExpiredException} from '../exceptions/otp-expired.exception';
import {OtpAlreadyUsedException} from "../exceptions/otp-alreadyVerified.exception";
import {OtpRequestNotFoundException} from '../exceptions/otp-request-not-found.exception';
import {OtpRepository, type OtpVerificationRecord} from '../repositories/otp.repository';
import {OtpTypeCacheService} from '../services/otp-type-cache.service';
import {CustomerAuthService} from '../services/customer-auth.service';
import {OnboardingConfigurationException} from '../../onboarding/exceptions/onboarding-configuration.exception';
import {CompleteOnboardingUseCase} from '../../onboarding/use-cases/complete-onboarding.usecase';
import {type VerifiedCustomerProfile} from '../../customer/customer.types';

export type VerifyOtpResult = {
    requestId: string;
    verifiedAt: string;
    customer?: VerifiedCustomerProfile;
    token?: string;
};

@Injectable()
export class VerifyOtpUseCase {
    constructor(
        private readonly databaseTransactionService: DatabaseTransactionService,
        private readonly otpTypeCacheService: OtpTypeCacheService,
        private readonly otpRepository: OtpRepository,
        private readonly completeOnboardingUseCase: CompleteOnboardingUseCase,
        private readonly customerAuthService: CustomerAuthService,
    ) {
    }

    async execute(dto: VerifyOtpDto): Promise<VerifyOtpResult> {
        return this.databaseTransactionService.runInTransaction(
            async (session) => {
                const now = new Date();
                const otpRequest = await this.otpRepository.findRequestForVerification({
                    requestId: dto.requestId
                }, session);

                if (!otpRequest) {
                    throw new OtpRequestNotFoundException();
                }

                const trackingParams = this.toTrackingParams(otpRequest);

                if (otpRequest.verifiedAt) {
                    throw new OtpAlreadyUsedException();
                }

                if (otpRequest.expiresAt.getTime() <= now.getTime()) {
                    throw new OtpExpiredException();
                }

                if (otpRequest.attemptCount >= OTP_MAX_ATTEMPTS) {
                    throw new OtpAttemptsExceededException();
                }

                if (otpRequest.otpCode !== dto.otpCode) {
                    const nextAttemptCount = otpRequest.attemptCount + 1;

                    await this.otpRepository.updateAttemptCount(otpRequest.id, nextAttemptCount, session);

                    if (nextAttemptCount >= OTP_MAX_ATTEMPTS) {
                        throw new OtpAttemptsExceededException();
                    }

                    throw new InvalidOtpException(OTP_MAX_ATTEMPTS - nextAttemptCount);
                }

                const verifiedOtp = await this.otpRepository.markVerified(
                    otpRequest.id, now, session);
                const customer = await this.resolveVerifiedCustomer(
                    dto.type, otpRequest.value, trackingParams, session);


                const token = dto.type === OTP_TYPE.MOBILE && customer
                    ? await this.customerAuthService.generateToken({
                        uuid: customer.uuid,
                        mobileNumber: customer.mobileNumber
                    })
                    : undefined;

                return this.buildVerificationResult(
                    verifiedOtp.uuid,
                    verifiedOtp.verifiedAt ?? now,
                    customer,
                    token ?? undefined
                );
            });
    }

    private toTrackingParams(otpRequest: OtpVerificationRecord): UtmTrackingParams {
        return {
            utmSource: otpRequest.utmSource ?? undefined,
            utmMedium: otpRequest.utmMedium ?? undefined,
            utmCampaign: otpRequest.utmCampaign ?? undefined,
            utmTerm: otpRequest.utmTerm ?? undefined,
            utmContent: otpRequest.utmContent ?? undefined
        };
    }

    private async resolveVerifiedCustomer(
        type: OtpType,
        value: string,
        trackingParams: UtmTrackingParams,
        session: DatabaseSession
    ) {
        if (type !== OTP_TYPE.MOBILE) {
            return undefined;
        }

        try {
            return await this.completeOnboardingUseCase.execute({
                mobileNumber: value,
                utmParams: trackingParams
            }, session);
        } catch (error) {
            if (error instanceof OnboardingConfigurationException) {
                throw new OtpConfigurationException(error.resource);
            }

            throw error;
        }
    }

    private buildVerificationResult(
        requestId: string,
        verifiedAt: Date,
        customer?: VerifiedCustomerProfile,
        token ?: string
    ): VerifyOtpResult {
        return {
            requestId,
            verifiedAt: verifiedAt.toISOString(),
            ...(customer ? {customer} : {}),
            ...(token ? {token} : {})
        };
    }
}
