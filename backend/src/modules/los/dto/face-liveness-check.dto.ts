import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class FaceLivenessCheckDto {
  @ApiPropertyOptional({ description: 'Public HTTPS image URL when no file is uploaded' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  link?: string;

  @ApiPropertyOptional({ description: 'Treat the uploaded file as a PDF instead of an image', default: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  usePdf?: boolean;
}
