import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateBankMasterDto {
  @ApiPropertyOptional({ example: 'HDFC Bank Ltd', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Whether the bank appears in customer dropdowns' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
