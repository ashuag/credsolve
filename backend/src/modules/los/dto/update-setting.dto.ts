import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSettingDto {
  @ApiPropertyOptional({ maxLength: 255, description: 'Stored setting value (string; parse per key at read time)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  value?: string;

  @ApiPropertyOptional({ maxLength: 255, description: 'LOS-facing description; empty string clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
