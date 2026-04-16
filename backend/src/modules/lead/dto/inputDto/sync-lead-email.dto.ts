import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';

export class SyncLeadEmailDto {
  @ApiPropertyOptional({ example: 'd47cfc0c-8e5b-4f5a-aa05-cab8d351ab36' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID('4', { message: 'leadUuid must be a valid UUID.' })
  leadUuid?: string;

  @ApiProperty({ example: 'customer@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address.' })
  email!: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  emailVerified!: boolean;

  @ApiPropertyOptional({ example: 'otp', enum: ['otp', 'google'] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(['otp', 'google'], { message: 'verificationType must be either otp or google.' })
  verificationType?: 'otp' | 'google';
}
