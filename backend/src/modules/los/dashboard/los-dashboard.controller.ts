import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosDashboardService } from './los-dashboard.service';

@ApiTags('LOS Dashboard')
@Controller('los/dashboard')
export class LosDashboardController {
  constructor(private readonly losDashboardService: LosDashboardService) {}

  @Get('crm')
  @ApiOperation({ summary: 'Fetch LOS CRM dashboard metrics' })
  getCrmDashboard() {
    return this.losDashboardService.getCrmDashboard();
  }
}
