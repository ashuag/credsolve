import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class KycFaceMatchCheckDto {
  @ApiPropertyOptional({ description: 'Public HTTPS URL for reference image (url1) when no reference file is uploaded' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  referenceUrl?: string;

  @ApiPropertyOptional({ description: 'Public HTTPS URL for probe image (url2) when no probe file is uploaded' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  probeUrl?: string;
}
