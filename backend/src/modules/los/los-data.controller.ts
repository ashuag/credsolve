import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosDenyAgentGuard } from './auth/los-deny-agent.guard';
import { LosAdminGuard } from './auth/los-admin.guard';
import { RejectWorkspaceRecordDto } from './dto/reject-workspace-record.dto';
import { LosLeadService } from './services/los-lead.service';
import { LosApplicationService } from './services/los-application.service';
import { LosCustomerService } from './services/los-customer.service';
import { LosDashboardService } from './services/los-dashboard.service';
import { LosMasterService } from './services/los-master.service';
import { LosRejectionService } from './services/los-rejection.service';
import { LosDisbursementService } from './services/los-disbursement.service';
import { LosLoanService } from './services/los-loan.service';
import { LosBureauReportService } from './services/los-bureau-report.service';
import { LosLeadReportService } from './services/los-lead-report.service';
import { LosTransactionReportService } from './services/los-transaction-report.service';

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
    private readonly losBureauReport: LosBureauReportService,
    private readonly losLeadReport: LosLeadReportService,
    private readonly losTransactionReport: LosTransactionReportService,
  ) {}

  @Get('dashboard/crm')
  @ApiOperation({ summary: 'LOS CRM dashboard aggregates (live counts from the book)' })
  dashboardCrm() {
    return this.losDashboard.getDashboardCrm();
  }

  @Get('bureau-reports')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'List stored CIBIL bureau reports for LOS Reports' })
  bureauReports() {
    return this.losBureauReport.listBureauReports();
  }

  @Get('bureau-reports/export')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Download stored CIBIL bureau reports as a Credit Assessment data workbook (.xlsx)' })
  async bureauReportsExport(@Res() res: Response): Promise<void> {
    const buffer = await this.losBureauReport.exportBureauReportsWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="Credit Assessment data.xlsx"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buffer);
  }

  @Get('lead-reports')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'List leads with application, loan, and repayment status for LOS Reports' })
  leadReports() {
    return this.losLeadReport.listLeadReports();
  }

  @Get('lead-reports/export')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Download the lead report as an Excel workbook (.xlsx)' })
  async leadReportsExport(@Res() res: Response): Promise<void> {
    const buffer = await this.losLeadReport.exportLeadReportsWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="Lead report.xlsx"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buffer);
  }

  @Get('lead-reports/:leadUuid')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Lead report detail: profile, offer, loan, and repayment status' })
  leadReportByUuid(@Param('leadUuid') leadUuid: string) {
    return this.losLeadReport.getLeadReportDetails(leadUuid);
  }

  @Get('transaction-reports')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'List disbursed-loan transactions with fees, repayment, and penal charges for LOS Reports',
  })
  transactionReports() {
    return this.losTransactionReport.listTransactionReports();
  }

  @Get('transaction-reports/export')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Download the transaction report as an Excel workbook (.xlsx)' })
  async transactionReportsExport(@Res() res: Response): Promise<void> {
    const buffer = await this.losTransactionReport.exportTransactionReportsWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="Transaction report.xlsx"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buffer);
  }

  @Get('leads/new')
  @ApiOperation({
    summary: 'List open leads for LOS lead management (excludes CONVERTED leads with an application)',
  })
  leads() {
    return this.losLead.listLeads();
  }

  @Get('leads/export')
  @ApiOperation({ summary: 'Download LOS leads as an Excel dump workbook (.xlsx)' })
  async leadsExport(@Res() res: Response): Promise<void> {
    const buffer = await this.losLead.exportLeadsWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="Leads dump.xlsx"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buffer);
  }

  @Get('applications')
  @ApiOperation({ summary: 'List latest applications for LOS application management' })
  applications() {
    return this.losApplication.listApplications();
  }

  @Get('applications/export')
  @ApiOperation({ summary: 'Download LOS applications as an Excel dump workbook (.xlsx)' })
  async applicationsExport(@Res() res: Response): Promise<void> {
    const buffer = await this.losApplication.exportApplicationsWorkbook();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="Applications dump.xlsx"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buffer);
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
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Reject an application with reason and ops note (LOS auth)' })
  rejectApplication(@Param('applicationUuid') applicationUuid: string, @Body() body: RejectWorkspaceRecordDto) {
    return this.losRejection.rejectApplication(applicationUuid, body);
  }

  @Post('applications/:applicationUuid/restart-journey')
  @UseGuards(LosAdminGuard)
  @ApiOperation({
    summary:
      'Admin: start a new customer journey from a rejected application’s lead, copying profile/PAN where possible',
  })
  restartApplicationJourney(@Param('applicationUuid') applicationUuid: string) {
    return this.losLead.restartRejectedJourneyFromApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/mark-internal-testing')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Hide an application (and its lead) from LOS listings and data dumps as internal testing',
  })
  markApplicationInternalTesting(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.markInternalTesting(applicationUuid);
  }

  @Post('applications/:applicationUuid/approve')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Approve an application after the customer journey is complete (status → APPROVED)',
  })
  approveApplication(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.approveApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/disburse')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Disburse an APPROVED application: create loan_account (loan_number = application_number), set DISBURSED, email final sanction letter (payment gateway skipped)',
  })
  disburseApplication(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.disburseApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/kyc/enable-re-kyc')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Enable re-KYC selfie: reset selfie / liveness so the customer can retake the face step (DigiLocker Aadhaar is kept if already captured)',
  })
  enableReKyc(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.enableReKyc(applicationUuid);
  }

  @Post('applications/:applicationUuid/bank/grant-penny-drop-attempt')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Grant one more penny-drop (bank verification) attempt when the customer has used the configured maximum',
  })
  grantPennyDropAttempt(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.grantPennyDropAttempt(applicationUuid);
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

  @Get('leads/:leadUuid/cibil-report/pdf')
  @ApiOperation({ summary: 'Stream CIBIL summary PDF for a lead (LOS auth)' })
  async leadCibilReportPdf(
    @Param('leadUuid') leadUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losLead.serveLeadCibilReportPdf(leadUuid, res);
  }

  @Get('leads/:leadUuid/cibil-report')
  @ApiOperation({ summary: 'Structured CIBIL report view for a lead (from latest bureau pull)' })
  leadCibilReport(@Param('leadUuid') leadUuid: string) {
    return this.losLead.getLeadCibilReport(leadUuid);
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

  @Post('leads/:leadUuid/restart-journey')
  @UseGuards(LosAdminGuard)
  @ApiOperation({
    summary: 'Admin: start a new customer journey from a rejected lead, copying profile/PAN where possible',
  })
  restartLeadJourney(@Param('leadUuid') leadUuid: string) {
    return this.losLead.restartRejectedJourney(leadUuid);
  }

  @Post('leads/:leadUuid/mark-internal-testing')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Hide a lead from LOS listings and data dumps as internal testing' })
  markLeadInternalTesting(@Param('leadUuid') leadUuid: string) {
    return this.losLead.markInternalTesting(leadUuid);
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
