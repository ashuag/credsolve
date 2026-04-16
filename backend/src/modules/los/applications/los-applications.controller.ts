import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosJwtGuard } from '../guards/los-jwt.guard';
import { LosApplicationsService } from './los-applications.service';

@ApiTags('LOS Applications')
@ApiBearerAuth()
@UseGuards(LosJwtGuard)
@Controller('los/applications')
export class LosApplicationsController {
  constructor(private readonly losApplicationsService: LosApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List LOS applications ordered by newest first' })
  getApplications() {
    return this.losApplicationsService.getApplications();
  }
}
