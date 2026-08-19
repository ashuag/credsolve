import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateRepaymentDueDateDto {
  @ApiPropertyOptional({
    example: '2026-09-10',
    description: 'Repayment due date (YYYY-MM-DD). May fall in a later month than the row month.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Whether this month override is used instead of month-end' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
