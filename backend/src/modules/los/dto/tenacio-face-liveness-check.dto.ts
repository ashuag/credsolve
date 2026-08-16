import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Tenacio face-liveness developer tool. Tenacio fetches the selfie itself from a public
 * HTTPS URL — provide `link` directly, or upload a `file` (multipart) which gets pushed
 * to S3 and resolved to a URL before the Tenacio call.
 */
export class TenacioFaceLivenessCheckDto {
  @ApiPropertyOptional({ description: 'Public HTTPS selfie URL when no file is uploaded' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  link?: string;

  @ApiPropertyOptional({ example: true, description: 'Customer consent for the liveness check (defaults to true)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  consent?: boolean;
}
