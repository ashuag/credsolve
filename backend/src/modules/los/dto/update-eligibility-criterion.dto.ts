import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEligibilityCriterionDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Stored rule value (e.g. threshold or true/false)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
