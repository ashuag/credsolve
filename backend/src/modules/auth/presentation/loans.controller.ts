import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CheckLoanEligibilityUseCase } from '../application/use-cases/check-loan-eligibility.use-case';
import { BankRepository } from '../infrastructure/repositories/bank.repository';
import { SettingsRepository } from '../infrastructure/repositories/settings.repository';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('loans')
@Controller('loans')
@UseGuards(RequiredCustomerSessionGuard)
export class LoansController {
  constructor(
    private readonly checkLoanEligibility: CheckLoanEligibilityUseCase,
    private readonly settingsRepository: SettingsRepository,
    private readonly banks: BankRepository
  ) {}

  @Get('eligibility')
  @ApiOperation({
    summary:
      'Pre-approved eligibility ceiling in INR from bureau credit-limit tier, clamped to MIN_LOAN_AMOUNT / MAX_LOAN_AMOUNT settings',
  })
  @ApiOkResponse({
    description: 'Pre-approved ceiling and the min/max bounds used for clamping',
    schema: {
      type: 'object',
      properties: {
        preApprovedAmountInr: { type: 'number', example: 25000 },
        minLoanAmountInr: { type: 'number', example: 2000 },
        maxLoanAmountInr: { type: 'number', example: 30000 },
      },
    },
  })
  eligibility(@Req() req: Request) {
    return this.checkLoanEligibility.executeForCustomerSession(req);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Loan calculation settings from active setting rows' })
  @ApiOkResponse({ description: 'Loan calculation settings used by customer loan-selection page' })
  async settings() {
    return this.settingsRepository.loadLoanCalculationSettings();
  }

  @Get('banks')
  @ApiOperation({ summary: 'List active banks for customer bank details dropdown' })
  @ApiOkResponse({ description: 'Alphabetically sorted active bank names' })
  async banksList() {
    return { banks: await this.banks.listActiveNames() };
  }
}
