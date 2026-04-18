import { Module } from '@nestjs/common';
import { GetCustomerSessionUseCase } from './application/use-cases/get-customer-session.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { SendOtpUseCase } from './application/use-cases/send-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { OtpCodeGenerator } from './infrastructure/crypto/otp-code.generator';
import { CustomerRepository } from './infrastructure/repositories/customer.repository';
import { LeadRepository } from './infrastructure/repositories/lead.repository';
import { LeadStatusRepository } from './infrastructure/repositories/lead-status.repository';
import { OtpRequestRepository } from './infrastructure/repositories/otp-request.repository';
import { OtpTypeRepository } from './infrastructure/repositories/otp-type.repository';
import { SettingsRepository } from './infrastructure/repositories/settings.repository';
import { CustomerSessionService } from './infrastructure/session/customer-session.service';
import { AuthController } from './presentation/auth.controller';
import { OptionalCustomerSessionGuard } from './presentation/guards/optional-customer-session.guard';

@Module({
  controllers: [AuthController],
  providers: [
    OtpCodeGenerator,
    CustomerSessionService,
    OtpTypeRepository,
    OtpRequestRepository,
    CustomerRepository,
    LeadRepository,
    LeadStatusRepository,
    SettingsRepository,
    OptionalCustomerSessionGuard,
    SendOtpUseCase,
    VerifyOtpUseCase,
    GetCustomerSessionUseCase,
    LogoutUseCase,
  ],
})
export class AuthModule {}
