import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class InitiateRepaymentDto {
  @ApiPropertyOptional({
    description:
      'Amount to pay in INR. Omit or set equal to remaining balance to pay in full. A smaller amount is a partial payment.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(5_000_000)
  amountInr?: number;
}
