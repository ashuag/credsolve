import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AuthController } from './auth.controller';
import { CustomerSessionModule } from './customer-session.module';
import { OtpRepository } from './repositories/otp.repository';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OtpEmailService } from './services/otp-email.service';
import { OtpIssuerService } from './services/otp-issuer.service';
import { OtpTypeCacheService } from './services/otp-type-cache.service';
import { GetOtpTypesUseCase } from './use-cases/get-otp-types.usecase';
import { SendOtpUseCase } from './use-cases/send-otp.usecase';
import { VerifyOtpUseCase } from './use-cases/verify-otp.usecase';

@Module({
  imports: [
    CustomerSessionModule,
    OnboardingModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    OtpRepository,
    GoogleOAuthService,
    OtpEmailService,
    OtpTypeCacheService,
    OtpIssuerService,
    GetOtpTypesUseCase,
    SendOtpUseCase,
    VerifyOtpUseCase,
  ],
})
export class AuthModule {}
