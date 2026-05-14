import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List latest leads for LOS lead management' })
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
