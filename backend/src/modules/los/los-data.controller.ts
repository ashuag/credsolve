import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosDataService } from './los-data.service';

@ApiTags('LOS Data')
@Controller('los')
@UseGuards(LosAuthGuard)
export class LosDataController {
  constructor(private readonly losData: LosDataService) {}

  @Get('dashboard/crm')
  @ApiOperation({ summary: 'LOS CRM dashboard aggregates (live counts from the book)' })
  dashboardCrm() {
    return this.losData.getDashboardCrm();
  }

  @Get('leads/new')
  @ApiOperation({
    summary: 'List open leads for LOS lead management (excludes CONVERTED leads with an application)',
  })
  leads() {
    return this.losData.listLeads();
  }

  @Get('applications')
  @ApiOperation({ summary: 'List latest applications for LOS application management' })
  applications() {
    return this.losData.listApplications();
  }

  @Get('applications/:applicationUuid')
  @ApiOperation({ summary: 'Get application details by application uuid' })
  applicationByUuid(@Param('applicationUuid') applicationUuid: string) {
    return this.losData.getApplicationDetails(applicationUuid);
  }

  @Get('applications/:applicationUuid/kyc/selfie-photo')
  @ApiOperation({ summary: 'Stream customer selfie for an application (LOS auth)' })
  async applicationSelfiePhoto(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losData.serveApplicationSelfiePhoto(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/kyc/aadhaar-photo')
  @ApiOperation({ summary: 'Stream DigiLocker Aadhaar photo for an application (LOS auth)' })
  async applicationAadhaarPhoto(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losData.serveApplicationAadhaarPhoto(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/cibil-report')
  @ApiOperation({
    summary: 'Structured CIBIL report view for an application (from latest bureau pull)',
  })
  applicationCibilReport(@Param('applicationUuid') applicationUuid: string) {
    return this.losData.getApplicationCibilReport(applicationUuid);
  }

  @Get('leads/:leadUuid')
  @ApiOperation({ summary: 'Get lead details by lead uuid' })
  leadByUuid(@Param('leadUuid') leadUuid: string) {
    return this.losData.getLeadDetails(leadUuid);
  }

  @Get('masters')
  @ApiOperation({ summary: 'Fetch LOS masters for filters/lookups' })
  masters() {
    return this.losData.getMasters();
  }
}
