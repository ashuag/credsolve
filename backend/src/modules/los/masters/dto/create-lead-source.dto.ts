import { LeadSourceType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLeadSourceDto {
  @ApiProperty({ example: 'Meta Ads' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ enum: LeadSourceType, example: LeadSourceType.ADS })
  @IsEnum(LeadSourceType)
  type!: LeadSourceType;
}
