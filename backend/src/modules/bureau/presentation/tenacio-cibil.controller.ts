import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CustomerOrLosAuthGuard } from '../../../common/guards/customer-or-los-auth.guard';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { FetchCibilDto } from '../application/dto/fetch-cibil.dto';
import { FetchCibilUseCase } from '../application/fetch-cibil.use-case';

function readClientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim();
  }
  return req.ip;
}

@ApiTags('Vendor — Tenacio')
@Controller('vendor/tenacio')
@UseGuards(RedisIpRateLimitGuard, CustomerOrLosAuthGuard)
export class TenacioCibilController {
  private readonly logger = new Logger(TenacioCibilController.name);

  constructor(private readonly fetchCibil: FetchCibilUseCase) {}

  @Post('cibil')
  @RateLimitByRoute('fetch-cibil')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch CIBIL / bureau data via Tenacio (audited to vendor_api_log)',
    description:
      'Same VENDOR_HOST / TENACIO_CLIENT_ID / TENACIO_API_KEY as PAN. POSTs to the `cibil-soft-pull` service under your services base (`…/services/cibil-soft-pull`) unless TENACIO_CIBIL_SERVICE overrides it. Uses TENACIO_CIBIL_WORKFLOW_ID or falls back to TENACIO_PAN_NSDL_WORKFLOW_ID. Authenticate with LOS `Authorization: Bearer` or customer session cookie.',
  })
  async fetchCibilRoute(@Req() req: Request, @Body() body: FetchCibilDto) {
    const actor = req.losUser ? 'los' : 'customer';
    const panTail = body.input?.panNumber?.trim().toUpperCase().slice(-4) ?? '????';
    this.logger.log(
      `POST /api/vendor/tenacio/cibil ip=${readClientIp(req) ?? 'unknown'} actor=${actor} leadUuid=${body.leadUuid ?? '(default)'} pan=******${panTail}`,
    );
    return this.fetchCibil.execute(req, body);
  }
}
