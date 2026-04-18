import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RateLimitByRoute } from '../../../common/rate-limit/rate-limit-route.decorator';
import { RedisIpRateLimitGuard } from '../../../common/rate-limit/redis-ip-rate-limit.guard';
import { SaveProfessionalDetailsDto } from '../application/dto/save-professional-details.dto';
import { SubmitProfessionalApplicationUseCase } from '../application/use-cases/submit-professional-application.use-case';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('applications')
@Controller('applications')
@UseGuards(RedisIpRateLimitGuard, RequiredCustomerSessionGuard)
export class ApplicationsController {
  constructor(private readonly submitProfessionalApplication: SubmitProfessionalApplicationUseCase) {}

  @Post('professional-details')
  @RateLimitByRoute('professional-details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Save professional / income fields, run eligibility, store approved amount, set lead to CONVERTED',
  })
  @ApiOkResponse({
    description: 'Eligibility outcome; approvedAmount/cibilScore when eligible',
  })
  professionalDetailsRoute(@Req() req: Request, @Body() body: SaveProfessionalDetailsDto) {
    return this.submitProfessionalApplication.execute(req, body);
  }
}
