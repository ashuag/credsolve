import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class SaveLoanSelectionDto {
  @ApiProperty({ description: 'Selected principal amount in INR' })
  @IsInt()
  @Min(1000)
  @Max(5_000_000)
  loanAmount!: number;

  @ApiProperty({ description: 'Tenure end date (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  tenureEndDate!: string;

  /** Must be whitelisted: global `forbidNonWhitelisted` otherwise rejects the whole request and `loan_detail` is not saved. */
  @ApiProperty({ description: 'Loan purpose label (matched to active `reason_for_loan.name`)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  loanPurpose!: string;
}

