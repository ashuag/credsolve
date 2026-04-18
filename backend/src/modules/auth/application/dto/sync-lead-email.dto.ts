import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Secured lead email sync using a Google-issued ID token (verified server-side). */
export class SyncLeadEmailDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Active lead uuid; defaults to current active lead for the customer.' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty({
    description: 'Google ID token (JWT) from Google Identity Services or OAuth redirect.',
    minLength: 20,
  })
  @IsString()
  @MinLength(20)
  googleIdToken!: string;
}
