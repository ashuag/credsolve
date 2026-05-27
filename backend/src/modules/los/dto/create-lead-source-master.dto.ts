import { ApiProperty } from '@nestjs/swagger';
import { LeadSourceType } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLeadSourceMasterDto {
  @ApiProperty({ example: 'Google Ads', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ enum: LeadSourceType, example: LeadSourceType.ADS })
  @IsEnum(LeadSourceType)
  type!: LeadSourceType;
}
