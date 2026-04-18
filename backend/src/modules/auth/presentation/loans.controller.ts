import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckLoanEligibilityUseCase } from '../application/use-cases/check-loan-eligibility.use-case';
import { RequiredCustomerSessionGuard } from './guards/required-customer-session.guard';

@ApiTags('loans')
@Controller('loans')
@UseGuards(RequiredCustomerSessionGuard)
export class LoansController {
  constructor(private readonly checkLoanEligibility: CheckLoanEligibilityUseCase) {}

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
}
