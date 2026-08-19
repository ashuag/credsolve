import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

export class CreateRepaymentDueDateDto {
  @ApiProperty({ example: 2026, minimum: 2020, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 8, minimum: 1, maximum: 12, description: 'Calendar month this override applies to (1–12)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({
    example: '2026-09-10',
    description: 'Repayment due date (YYYY-MM-DD). May fall in a later month, e.g. Aug 2026 → 10 Sep 2026.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate!: string;
}
