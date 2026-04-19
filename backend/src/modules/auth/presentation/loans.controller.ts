import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
    summary: 'Check loan pre-approval amount (demo: random ₹5k–₹50k for signed-in customers)',
  })
  @ApiOkResponse({
    description: 'Pre-approved ceiling in INR',
    schema: {
      type: 'object',
      properties: {
        preApprovedAmountInr: { type: 'number', example: 25000 },
      },
    },
  })
  eligibility() {
    return this.checkLoanEligibility.execute();
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
