import { Module } from '@nestjs/common';
import { BreModule } from '../../common/bre/bre.module';
import { CibilModule } from '../../common/cibil/cibil.module';
import { LoanDocumentsModule } from '../../common/loan-documents/loan-documents.module';
import { SmsModule } from '../../common/sms/sms.module';
import { StorageModule } from '../../common/storage/storage.module';
import { LosAuthController } from './auth/los-auth.controller';
import { LosAuthService } from './auth/los-auth.service';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosSessionService } from './auth/los-session.service';
import { LosDataController } from './los-data.controller';
import { LosLeadService } from './services/los-lead.service';
import { LosApplicationService } from './services/los-application.service';
import { LosDashboardService } from './services/los-dashboard.service';
import { LosMasterService } from './services/los-master.service';
import { LosNegativeListService } from './services/los-negative-list.service';
import { LosMastersController } from './los-masters.controller';
import { LosNegativeListsController } from './los-negative-lists.controller';
import { LosBreController } from './los-bre.controller';
import { LosDeveloperToolsController } from './los-developer-tools.controller';
import { LosTeamController } from './los-team.controller';
import { LosTeamService } from './los-team.service';
import { LosRejectionService } from './services/los-rejection.service';
import { LosKycDevToolsService } from './services/los-kyc-dev-tools.service';

@Module({
  imports: [BreModule, CibilModule, StorageModule, LoanDocumentsModule, SmsModule],
  controllers: [
    LosAuthController,
    LosDataController,
    LosMastersController,
    LosNegativeListsController,
    LosTeamController,
    LosBreController,
    LosDeveloperToolsController,
  ],
  providers: [
    LosAuthService,
    LosSessionService,
    LosAuthGuard,
    LosTeamService,
    LosLeadService,
    LosApplicationService,
    LosDashboardService,
    LosMasterService,
    LosNegativeListService,
    LosRejectionService,
    LosKycDevToolsService,
  ],
  exports: [LosSessionService],
})
export class LosModule {}
