import { forwardRef, Module } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { CustomerSessionModule } from '../auth/customer-session.module';
import { CustomerLeadController } from './controllers/customer-lead.controller';
import { LeadDetailsRepository } from './repositories/lead-details.repository';
import { LeadRepository } from './repositories/lead.repository';
import { LeadStatusRepository } from './repositories/lead-status.repository';
import { LeadService } from './services/lead.service';

@Module({
  imports: [CustomerSessionModule, forwardRef(() => ApplicationModule)],
  controllers: [CustomerLeadController],
  providers: [
    LeadDetailsRepository,
    LeadRepository,
    LeadStatusRepository,
    LeadService
  ],
  exports: [LeadDetailsRepository, LeadService]
})
export class LeadModule {}
