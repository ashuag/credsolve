import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LosAuthGuard } from './auth/los-auth.guard';
import { RejectWorkspaceRecordDto } from './dto/reject-workspace-record.dto';
import { LosLeadService } from './services/los-lead.service';
import { LosApplicationService } from './services/los-application.service';
import { LosCustomerService } from './services/los-customer.service';
import { LosDashboardService } from './services/los-dashboard.service';
import { LosMasterService } from './services/los-master.service';
import { LosRejectionService } from './services/los-rejection.service';
import { LosDisbursementService } from './services/los-disbursement.service';
import { LosLoanService } from './services/los-loan.service';
@ApiTags('LOS Data')
@Controller('los')
@UseGuards(LosAuthGuard)
export class LosDataController {
  constructor(
    private readonly losLead: LosLeadService,
    private readonly losApplication: LosApplicationService,
    private readonly losCustomer: LosCustomerService,
    private readonly losDashboard: LosDashboardService,
    private readonly losMaster: LosMasterService,
    private readonly losRejection: LosRejectionService,
    private readonly losDisbursement: LosDisbursementService,
    private readonly losLoan: LosLoanService,
  ) {}

  @Get('dashboard/crm')
  @ApiOperation({ summary: 'LOS CRM dashboard aggregates (live counts from the book)' })
  dashboardCrm() {
    return this.losDashboard.getDashboardCrm();
  }

  @Get('leads/new')
  @ApiOperation({
    summary: 'List open leads for LOS lead management (excludes CONVERTED leads with an application)',
  })
  leads() {
    return this.losLead.listLeads();
  }

  @Get('applications')
  @ApiOperation({ summary: 'List latest applications for LOS application management' })
  applications() {
    return this.losApplication.listApplications();
  }

  @Get('loans')
  @ApiOperation({ summary: 'List disbursed loans for LOS loan management' })
  loans() {
    return this.losLoan.listLoans();
  }

  @Get('loans/:loanUuid')
  @ApiOperation({ summary: 'Get loan details by loan uuid' })
  loanByUuid(@Param('loanUuid') loanUuid: string) {
    return this.losLoan.getLoanDetails(loanUuid);
  }

  @Get('applications/:applicationUuid')
  @ApiOperation({ summary: 'Get application details by application uuid' })
  applicationByUuid(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.getApplicationDetails(applicationUuid);
  }

  @Post('applications/:applicationUuid/reject')
  @ApiOperation({ summary: 'Reject an application with reason and ops note (LOS auth)' })
  rejectApplication(@Param('applicationUuid') applicationUuid: string, @Body() body: RejectWorkspaceRecordDto) {
    return this.losRejection.rejectApplication(applicationUuid, body);
  }

  @Post('applications/:applicationUuid/approve')
  @ApiOperation({
    summary: 'Approve an application after the customer journey is complete (status → APPROVED)',
  })
  approveApplication(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.approveApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/disburse')
  @ApiOperation({
    summary:
      'Disburse an APPROVED application: create loan_account (loan_number = application_number), set DISBURSED, email final sanction letter (payment gateway skipped)',
  })
  disburseApplication(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.disburseApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/kyc/enable-re-kyc')
  @ApiOperation({
    summary:
      'Enable re-KYC: reset DigiLocker / KYC status so the customer can redo identity verification',
  })
  enableReKyc(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.enableReKyc(applicationUuid);
  }

  @Get('applications/:applicationUuid/kyc/selfie-photo')
  @ApiOperation({ summary: 'Stream customer selfie for an application (LOS auth)' })
  async applicationSelfiePhoto(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationSelfiePhoto(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/kyc/aadhaar-photo')
  @ApiOperation({ summary: 'Stream DigiLocker Aadhaar photo for an application (LOS auth)' })
  async applicationAadhaarPhoto(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationAadhaarPhoto(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/kyc/liveness-video')
  @ApiOperation({ summary: 'Stream customer active-liveness short video for an application (LOS auth)' })
  async applicationLivenessVideo(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationLivenessVideo(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/cibil-report/pdf')
  @ApiOperation({ summary: 'Stream CIBIL summary PDF for an application (LOS auth)' })
  async applicationCibilReportPdf(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationCibilReportPdf(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/cibil-report')
  @ApiOperation({
    summary: 'Structured CIBIL report view for an application (from latest bureau pull)',
  })
  applicationCibilReport(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.getApplicationCibilReport(applicationUuid);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List customers for LOS customer management' })
  customers() {
    return this.losCustomer.listCustomers();
  }

  @Get('customers/:customerUuid')
  @ApiOperation({ summary: 'Get customer details with leads and applications' })
  customerByUuid(@Param('customerUuid') customerUuid: string) {
    return this.losCustomer.getCustomerDetails(customerUuid);
  }

  @Get('leads/:leadUuid')
  @ApiOperation({ summary: 'Get lead details by lead uuid' })
  leadByUuid(@Param('leadUuid') leadUuid: string) {
    return this.losLead.getLeadDetails(leadUuid);
  }

  @Post('leads/:leadUuid/reject')
  @ApiOperation({ summary: 'Reject a lead with reason and ops note (LOS auth)' })
  rejectLead(@Param('leadUuid') leadUuid: string, @Body() body: RejectWorkspaceRecordDto) {
    return this.losRejection.rejectLead(leadUuid, body);
  }

  @Get('masters')
  @ApiOperation({ summary: 'Fetch LOS masters for filters/lookups' })
  masters() {
    return this.losMaster.getMasters();
  }

  @Get('applications/:applicationUuid/loan-documents/:docType')
  @ApiOperation({ summary: 'Stream a generated loan document PDF (LOS auth)' })
  async applicationLoanDocument(
    @Param('applicationUuid') applicationUuid: string,
    @Param('docType') docType: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationLoanDocument(applicationUuid, docType, res);
  }

  @Post('applications/:applicationUuid/loan-documents/generate')
  @ApiOperation({ summary: 'Generate (or regenerate) loan document PDFs for an application (LOS auth)' })
  generateLoanDocuments(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.generateLoanDocuments(applicationUuid);
  }
}
