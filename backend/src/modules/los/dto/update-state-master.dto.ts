import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStateMasterDto {
  @ApiPropertyOptional({ example: 'Maharashtra', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'MH', maxLength: 5 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5)
  code?: string;

  @ApiPropertyOptional({ description: 'Whether the state appears in customer dropdowns' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
