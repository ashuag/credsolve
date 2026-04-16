import { forwardRef, Module } from '@nestjs/common';
import { CustomerSessionModule } from '../auth/customer-session.module';
import { LeadModule } from '../lead/lead.module';
import { CustomerApplicationController } from './controllers/customer-application.controller';
import { ApplicationRepository } from './repositories/application.repository';
import { ApplicationStatusRepository } from './repositories/application-status.repository';
import { ApplicationService } from './services/application.service';
import { PanVerificationService } from './services/pan-verification.service';
import { NsdlBureauService } from './services/nsdl-bureau.service';
import { EligibilityService } from './services/eligibility.service';
import { EligibilityCriteriaRepository } from './repositories/eligibility-criteria.repository';
import { CreditLimitTierRepository } from './repositories/credit-limit-tier.repository';
import { ApplicationEligibilityRepository } from './repositories/application-eligibility.repository';
import { ApplicationDetailsRepository } from './repositories/application-details.repository';
import { ReasonForLoanRepository } from './repositories/reason-for-loan.repository';
import { SettingRepository } from './repositories/setting.repository';

@Module({
  imports: [CustomerSessionModule, forwardRef(() => LeadModule)],
  controllers: [CustomerApplicationController],
  providers: [
    ApplicationRepository,
    ApplicationDetailsRepository,
    ApplicationStatusRepository,
    ApplicationEligibilityRepository,
    EligibilityCriteriaRepository,
    CreditLimitTierRepository,
    ReasonForLoanRepository,
    SettingRepository,
    ApplicationService,
    PanVerificationService,
    NsdlBureauService,
    EligibilityService,
  ],
  exports: [ApplicationService, EligibilityCriteriaRepository, CreditLimitTierRepository]
})
export class ApplicationModule {}
