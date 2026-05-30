import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSourceUtmDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
