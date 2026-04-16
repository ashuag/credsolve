import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { LeadModule } from '../lead/lead.module';
import { CompleteOnboardingUseCase } from './use-cases/complete-onboarding.usecase';

@Module({
  imports: [CustomerModule, LeadModule],
  providers: [CompleteOnboardingUseCase],
  exports: [CompleteOnboardingUseCase]
})
export class OnboardingModule {}
