import { Module } from '@nestjs/common';
import { BreModule } from '../../common/bre/bre.module';
import { EmailModule } from '../../common/email/email.module';
import { VendorApiModule } from '../../common/vendor/vendor-api.module';
import { RedisIpRateLimitGuard } from '../../common/rate-limit/redis-ip-rate-limit.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { CheckLoanEligibilityUseCase } from './application/use-cases/check-loan-eligibility.use-case';
import { GetCustomerLeadStatusUseCase } from './application/use-cases/get-customer-lead-status.use-case';
import { GetCustomerSessionUseCase } from './application/use-cases/get-customer-session.use-case';
import { GetCustomerLoansDashboardUseCase } from './application/use-cases/get-customer-loans-dashboard.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { SendOtpUseCase } from './application/use-cases/send-otp.use-case';
import { SaveLeadDetailsUseCase } from './application/use-cases/save-lead-details.use-case';
import { SaveLoanSelectionUseCase } from './application/use-cases/save-loan-selection.use-case';
import { SubmitProfessionalApplicationUseCase } from './application/use-cases/submit-professional-application.use-case';
import { SyncLeadEmailFromGoogleTokenUseCase } from './application/use-cases/sync-lead-email-from-google-token.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { PostBureauOfferService } from './application/services/post-bureau-offer.service';
import { VerifyPanUseCase } from './application/use-cases/verify-pan.use-case';
import { InitDigilockerUseCase } from './application/use-cases/init-digilocker.use-case';
import { SaveKycDocumentsUseCase } from './application/use-cases/save-kyc-documents.use-case';
import { SaveBankDetailsUseCase } from './application/use-cases/save-bank-details.use-case';
import { OtpCodeGenerator } from './infrastructure/crypto/otp-code.generator';
import { CustomerGoogleOauthService } from './infrastructure/google/customer-google-oauth.service';
import { CustomerRepository } from './infrastructure/repositories/customer.repository';
import { BankRepository } from './infrastructure/repositories/bank.repository';
import { LeadRepository } from './infrastructure/repositories/lead.repository';
import { ApplicationRepository } from './infrastructure/repositories/application.repository';
import { BureauReportRepository } from './infrastructure/repositories/bureau-report.repository';
import { LeadStatusRepository } from './infrastructure/repositories/lead-status.repository';
import { OtpRequestRepository } from './infrastructure/repositories/otp-request.repository';
import { OtpTypeRepository } from './infrastructure/repositories/otp-type.repository';
import { SettingsRepository } from './infrastructure/repositories/settings.repository';
import { CustomerSessionService } from './infrastructure/session/customer-session.service';
import { AuthController } from './presentation/auth.controller';
import { CustomerLeadsController } from './presentation/customer-leads.controller';
import { ApplicationsController } from './presentation/applications.controller';
import { LoansController } from './presentation/loans.controller';
import { LookupController } from './presentation/lookup.controller';
import { OptionalCustomerSessionGuard } from './presentation/guards/optional-customer-session.guard';
import { RequiredCustomerSessionGuard } from './presentation/guards/required-customer-session.guard';

@Module({
  imports: [BreModule, EmailModule, PrismaModule, VendorApiModule],
  controllers: [
    AuthController,
    ApplicationsController,
    CustomerLeadsController,
    LoansController,
    LookupController,
  ],
  providers: [
    RedisIpRateLimitGuard,
    OtpCodeGenerator,
    CustomerSessionService,
    OtpTypeRepository,
    OtpRequestRepository,
    CustomerRepository,
    BankRepository,
    LeadRepository,
    ApplicationRepository,
    BureauReportRepository,
    LeadStatusRepository,
    SettingsRepository,
    OptionalCustomerSessionGuard,
    RequiredCustomerSessionGuard,
    CustomerGoogleOauthService,
    SyncLeadEmailFromGoogleTokenUseCase,
    SaveLeadDetailsUseCase,
    GetCustomerLeadStatusUseCase,
    CheckLoanEligibilityUseCase,
    PostBureauOfferService,
    SubmitProfessionalApplicationUseCase,
    SaveLoanSelectionUseCase,
    SaveKycDocumentsUseCase,
    SaveBankDetailsUseCase,
    SendOtpUseCase,
    VerifyOtpUseCase,
    VerifyPanUseCase,
    InitDigilockerUseCase,
    GetCustomerSessionUseCase,
    GetCustomerLoansDashboardUseCase,
    LogoutUseCase,
  ],
  exports: [CustomerSessionService, BureauReportRepository],
})
export class AuthModule {}
