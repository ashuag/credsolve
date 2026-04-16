import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosJwtGuard } from '../guards/los-jwt.guard';
import { LosLeadsService } from './los-leads.service';

@ApiTags('LOS Leads')
@ApiBearerAuth()
@UseGuards(LosJwtGuard)
@Controller('los/leads')
export class LosLeadsController {
  constructor(private readonly losLeadsService: LosLeadsService) {}

  @Get('new')
  @ApiOperation({ summary: 'List active LOS leads ordered by newest first' })
  getNewLeads() {
    return this.losLeadsService.getNewLeads();
  }
}
