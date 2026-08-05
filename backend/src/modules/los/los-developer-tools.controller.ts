import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosAuthGuard } from './auth/los-auth.guard';
import { CibilVendorFetchCheckDto } from './dto/cibil-vendor-fetch-check.dto';
import { LosCibilDevToolsService } from './services/los-cibil-dev-tools.service';

@ApiTags('LOS Developer Tools')
@Controller(['los/developer-tools', 'los/los/developer-tools'])
@UseGuards(LosAuthGuard)
export class LosDeveloperToolsController {
  constructor(private readonly cibilDevTools: LosCibilDevToolsService) {}

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
