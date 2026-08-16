import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateNamedMasterDto {
  @ApiPropertyOptional({ example: 'Salaried', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ description: 'Whether the record appears in customer dropdowns' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
