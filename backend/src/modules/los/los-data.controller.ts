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
