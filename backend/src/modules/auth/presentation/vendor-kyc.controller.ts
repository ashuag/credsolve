import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { ServeKycLivenessSelfieVendorUseCase } from '../application/use-cases/serve-kyc-liveness-selfie-vendor.use-case';

@ApiTags('Vendor — KYC')
@Controller('vendor/kyc')
@UseGuards(RedisIpRateLimitGuard)
export class VendorKycController {
  constructor(private readonly serveLivenessSelfie: ServeKycLivenessSelfieVendorUseCase) {}

  @Get('liveness-selfie')
  @ApiOperation({
    summary: 'Fetch stored selfie for Tenacio liveness (short-lived signed token, no session cookie)',
  })
  async livenessSelfie(
    @Req() req: Request,
    @Res() res: Response,
    @Query('token') _token?: string,
  ): Promise<void> {
    await this.serveLivenessSelfie.execute(req, res);
  }
}
