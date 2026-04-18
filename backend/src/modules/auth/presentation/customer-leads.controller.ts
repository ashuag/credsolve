import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { SaveLeadDetailsDto } from '../application/dto/save-lead-details.dto';
import { SyncLeadEmailDto } from '../application/dto/sync-lead-email.dto';
import { GetCustomerLeadStatusUseCase } from '../application/use-cases/get-customer-lead-status.use-case';
import { SaveLeadDetailsUseCase } from '../application/use-cases/save-lead-details.use-case';
import { SyncLeadEmailFromGoogleTokenUseCase } from '../application/use-cases/sync-lead-email-from-google-token.use-case';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('leads')
@Controller('leads')
@UseGuards(RedisIpRateLimitGuard, RequiredCustomerSessionGuard)
export class CustomerLeadsController {
  constructor(
    private readonly syncLeadEmailFromGoogle: SyncLeadEmailFromGoogleTokenUseCase,
    private readonly saveLeadDetailsFlow: SaveLeadDetailsUseCase,
    private readonly getCustomerLeadStatusFlow: GetCustomerLeadStatusUseCase
  ) {}

  @Post('email')
  @RateLimitByRoute('sync-lead-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Attach Google-verified email to the active lead (requires mobile session + Google ID token)',
  })
  @ApiOkResponse({ description: 'Email stored on lead with GOOGLE verification type' })
  syncLeadEmailRoute(@Req() req: Request, @Body() body: SyncLeadEmailDto) {
    return this.syncLeadEmailFromGoogle.execute(req, body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Current active lead id and status for the signed-in customer' })
  @ApiOkResponse({ description: 'Lead identifiers when an active lead exists' })
  leadStatusRoute(@Req() req: Request) {
    return this.getCustomerLeadStatusFlow.execute(req);
  }

  @Post('details')
  @RateLimitByRoute('save-lead-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update lead_detail for onboarding / profile' })
  @ApiOkResponse({ description: 'Details saved' })
  saveLeadDetailsRoute(@Req() req: Request, @Body() body: SaveLeadDetailsDto) {
    return this.saveLeadDetailsFlow.execute(req, body);
  }
}
