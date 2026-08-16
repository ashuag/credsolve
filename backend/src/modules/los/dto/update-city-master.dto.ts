import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCityMasterDto {
  @ApiPropertyOptional({ example: 'Mumbai', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  stateId?: number;

  @ApiPropertyOptional({ description: 'Whether the city appears in customer dropdowns' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
