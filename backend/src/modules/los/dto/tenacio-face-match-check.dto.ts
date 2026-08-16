import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Tenacio face-match developer tool. Tenacio fetches both photos itself from public HTTPS
 * URLs — provide `url1`/`url2` directly, or upload `file1`/`file2` (multipart), which get
 * pushed to S3 and resolved to URLs before the Tenacio call.
 */
export class TenacioFaceMatchCheckDto {
  @ApiPropertyOptional({ description: 'Public HTTPS URL of the reference/document photo (e.g. Aadhaar) when no file1 is uploaded' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url1?: string;

  @ApiPropertyOptional({ description: 'Public HTTPS URL of the live selfie photo when no file2 is uploaded' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url2?: string;

  @ApiPropertyOptional({ example: true, description: 'Customer consent for the face match (defaults to true)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  consent?: boolean;
}
