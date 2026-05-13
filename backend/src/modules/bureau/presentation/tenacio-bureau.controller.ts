import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CustomerOrLosAuthGuard } from '../../../common/guards/customer-or-los-auth.guard';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { FetchBureauDto } from '../application/dto/fetch-bureau.dto';
import { FetchBureauUseCase } from '../application/fetch-bureau.use-case';

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
export class TenacioBureauController {
  private readonly logger = new Logger(TenacioBureauController.name);

  constructor(private readonly fetchBureau: FetchBureauUseCase) {}

  @Post('bureau')
  @RateLimitByRoute('fetch-bureau')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch bureau (credit) data via Tenacio (audited to vendor_api_log)',
    description:
      'Uses TENACIO_CIBIL_URL (full HTTPS bureau URL, recommended) or VENDOR_HOST + TENACIO_CIBIL_SERVICE path. Same TENACIO_CLIENT_ID / TENACIO_API_KEY as PAN. `workflow-id` header uses TENACIO_CIBIL_WORKFLOW_ID only. LOS `Authorization: Bearer` or customer session cookie.',
  })
  async fetchBureauRoute(@Req() req: Request, @Body() body: FetchBureauDto) {
    const actor = req.losUser ? 'los' : 'customer';
    const panTail = body.input?.panNumber?.trim().toUpperCase().slice(-4) ?? '????';
    this.logger.log(
      `POST /api/vendor/tenacio/bureau ip=${readClientIp(req) ?? 'unknown'} actor=${actor} leadUuid=${body.leadUuid ?? '(default)'} pan=******${panTail}`,
    );
    return this.fetchBureau.execute(req, body);
  }
}
