import { Module } from '@nestjs/common';
import { BreModule } from '../../common/bre/bre.module';
import { CibilModule } from '../../common/cibil/cibil.module';
import { EmailModule } from '../../common/email/email.module';
import { LoanDocumentsModule } from '../../common/loan-documents/loan-documents.module';
import { SmsModule } from '../../common/sms/sms.module';
import { StorageModule } from '../../common/storage/storage.module';
import { ContactModule } from '../contact/contact.module';
import { LosAuthController } from './auth/los-auth.controller';
import { LosAuthService } from './auth/los-auth.service';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosDenyAgentGuard, LosDenyAgentWritesGuard } from './auth/los-deny-agent.guard';
import { LosAdminGuard } from './auth/los-admin.guard';
import { LosSessionService } from './auth/los-session.service';
import { LosDataController } from './los-data.controller';
import { LosLeadService } from './services/los-lead.service';
import { LosApplicationService } from './services/los-application.service';
import { LosCustomerService } from './services/los-customer.service';
import { LosDashboardService } from './services/los-dashboard.service';
import { LosMasterService } from './services/los-master.service';
import { LosNegativeListService } from './services/los-negative-list.service';
import { LosMastersController } from './los-masters.controller';
import { LosNegativeListsController } from './los-negative-lists.controller';
import { LosBreController } from './los-bre.controller';
import { LosContactController } from './los-contact.controller';
import { LosDeveloperToolsController } from './los-developer-tools.controller';
import { LosTeamController } from './los-team.controller';
import { LosTeamService } from './los-team.service';
import { LosRejectionService } from './services/los-rejection.service';
import { LosDisbursementService } from './services/los-disbursement.service';
import { LosLoanService } from './services/los-loan.service';
import { LosBureauReportService } from './services/los-bureau-report.service';
import { LosLeadReportService } from './services/los-lead-report.service';
import { LosTransactionReportService } from './services/los-transaction-report.service';
import { LosCibilDevToolsService } from './services/los-cibil-dev-tools.service';
import { LosFaceLivenessDevToolsService } from './services/los-face-liveness-dev-tools.service';
import { LosKycDevToolsService } from './services/los-kyc-dev-tools.service';
import { LosNameMatchDevToolsService } from './services/los-name-match-dev-tools.service';
import { LosPanDevToolsService } from './services/los-pan-dev-tools.service';
import { LosTenacioFaceDevToolsService } from './services/los-tenacio-face-dev-tools.service';
import { LosVendorApiLogService } from './services/los-vendor-api-log.service';

@Module({
  imports: [BreModule, CibilModule, StorageModule, LoanDocumentsModule, SmsModule, ContactModule, EmailModule],
  controllers: [
    LosAuthController,
    LosDataController,
    LosMastersController,
    LosNegativeListsController,
    LosTeamController,
    LosBreController,
    LosContactController,
    LosDeveloperToolsController,
  ],
  providers: [
    LosAuthService,
    LosSessionService,
    LosAuthGuard,
    LosDenyAgentGuard,
    LosDenyAgentWritesGuard,
    LosAdminGuard,
    LosTeamService,
    LosLeadService,
    LosApplicationService,
    LosCustomerService,
    LosDashboardService,
    LosMasterService,
    LosNegativeListService,
    LosRejectionService,
    LosDisbursementService,
    LosLoanService,
    LosBureauReportService,
    LosLeadReportService,
    LosTransactionReportService,
    LosCibilDevToolsService,
    LosFaceLivenessDevToolsService,
    LosKycDevToolsService,
    LosNameMatchDevToolsService,
    LosPanDevToolsService,
    LosTenacioFaceDevToolsService,
    LosVendorApiLogService,
  ],
  exports: [LosSessionService],
})
export class LosModule {}
