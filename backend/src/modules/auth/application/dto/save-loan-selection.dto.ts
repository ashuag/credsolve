import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min, Matches } from 'class-validator';

export class SaveLoanSelectionDto {
  @ApiProperty({ description: 'Selected principal amount in INR' })
  @IsInt()
  @Min(1000)
  @Max(5_000_000)
  loanAmount!: number;

  @ApiProperty({ description: 'Tenure end date (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  tenureEndDate!: string;
}

