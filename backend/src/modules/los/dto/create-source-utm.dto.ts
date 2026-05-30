import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSourceUtmDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  leadSourceId!: number;

  @ApiPropertyOptional({ example: 'google' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  utmSource?: string;

  @ApiPropertyOptional({ example: 'summer-sale' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  utmCampaign?: string;

  @ApiPropertyOptional({ example: 'keyword' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  utmTerm?: string;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  utmMedium?: string;

  @ApiPropertyOptional({ example: 'banner-v1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  utmContent?: string;
}
