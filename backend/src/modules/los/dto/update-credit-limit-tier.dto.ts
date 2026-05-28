import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class UpdateCreditLimitTierDto {
  @ApiPropertyOptional({ description: 'Minimum unsecured exposure (INR) for this tier band' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minUnsecuredLoan?: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Maximum unsecured exposure (INR); null means no upper bound',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  maxUnsecuredLoan?: number | null;

  @ApiPropertyOptional({ description: 'Maximum bullet loan amount (INR) for this tier' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxBulletLoan?: number;

  @ApiPropertyOptional({ description: 'Evaluation order (lower bands first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
