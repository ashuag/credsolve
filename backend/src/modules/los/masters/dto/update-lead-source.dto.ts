import { LeadSourceType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateLeadSourceDto {
  @ApiPropertyOptional({ example: 'Meta Ads' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ enum: LeadSourceType, example: LeadSourceType.ADS })
  @IsOptional()
  @IsEnum(LeadSourceType)
  type?: LeadSourceType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
