import { Injectable } from '@nestjs/common';
import { type DatabaseSession } from '../../../../prisma/database-session';
import { type UtmTrackingParams } from '../../../common/types/utm-tracking.types';
import { type VerifiedCustomerProfile } from '../../customer/customer.types';
import { CustomerService } from '../../customer/services/customer.service';
import { LeadConfigurationException } from '../../lead/exceptions/lead-configuration.exception';
import { LeadService } from '../../lead/services/lead.service';
import { OnboardingConfigurationException } from '../exceptions/onboarding-configuration.exception';

@Injectable()
export class CompleteOnboardingUseCase {
  constructor(
    private readonly customerService: CustomerService,
    private readonly leadService: LeadService
  ) {}

  async execute(params: {
    mobileNumber: string;
    utmParams?: UtmTrackingParams;
  }, session?: DatabaseSession): Promise<VerifiedCustomerProfile | undefined> {
    const customer = await this.customerService.ensureByMobileNumber(
        params.mobileNumber, session
    );

    if (!customer) {
      return undefined;
    }

    try {
      const lead = await this.leadService.ensureForCustomer(
          BigInt(customer.id), params.utmParams, session
      );

      return {
        ...customer,
        ...(lead ? { leadUuid: lead.uuid, leadEmail: lead.email, leadStatus: lead.leadStatus } : {})
      };
    } catch (error) {
      if (error instanceof LeadConfigurationException) {
        throw new OnboardingConfigurationException(error.resource);
      }

      throw error;
    }
  }
}
