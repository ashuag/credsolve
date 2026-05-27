import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSourceType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateLeadSourceMasterDto {
  @ApiPropertyOptional({ example: 'Google Ads', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ enum: LeadSourceType, example: LeadSourceType.ADS })
  @IsOptional()
  @IsEnum(LeadSourceType)
  type?: LeadSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
