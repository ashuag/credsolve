import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosAuthGuard } from './auth/los-auth.guard';
import { CibilVendorFetchCheckDto } from './dto/cibil-vendor-fetch-check.dto';
import { ListVendorApiLogsQueryDto } from './dto/list-vendor-api-logs-query.dto';
import { LosCibilDevToolsService } from './services/los-cibil-dev-tools.service';
import { LosVendorApiLogService } from './services/los-vendor-api-log.service';

@ApiTags('LOS Developer Tools')
@Controller(['los/developer-tools', 'los/los/developer-tools'])
@UseGuards(LosAuthGuard)
export class LosDeveloperToolsController {
  constructor(
    private readonly cibilDevTools: LosCibilDevToolsService,
    private readonly vendorApiLogs: LosVendorApiLogService,
  ) {}

  @Get('vendor-api-logs')
  @ApiOperation({
    summary: 'List vendor_api_log rows (paginated, filterable, sortable)',
  })
  listVendorApiLogs(@Query() query: ListVendorApiLogsQueryDto) {
    return this.vendorApiLogs.list(query);
  }

  @Get('vendor-api-logs/:uuid')
  @ApiOperation({ summary: 'Get one vendor_api_log row including request/response payloads' })
  getVendorApiLog(@Param('uuid') uuid: string) {
    return this.vendorApiLogs.getByUuid(uuid);
  }

  @Post('cibil-tenacio-fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Live Tenacio CIBIL soft-pull (bypasses the vendor API config switch)',
    description:
      'Calls the Tenacio bureau soft-pull directly using TENACIO_* env config. The call is live and audited in vendor_api_log; no lead or bureau_report record is created or updated.',
  })
  async cibilTenacioFetch(@Body() body: CibilVendorFetchCheckDto) {
    return this.cibilDevTools.runTenacioFetch(body);
  }

  @Post('cibil-surepass-fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Live Surepass CIBIL fetch-report (bypasses the vendor API config switch)',
    description:
      'Calls the Surepass credit-report-cibil endpoint directly using SUREPASS_* env config. The response is returned in the Tenacio-shaped envelope; the raw Surepass body is stored in vendor_api_log. No lead or bureau_report record is created or updated.',
  })
  async cibilSurepassFetch(@Body() body: CibilVendorFetchCheckDto) {
    return this.cibilDevTools.runSurepassFetch(body);
  }
}
