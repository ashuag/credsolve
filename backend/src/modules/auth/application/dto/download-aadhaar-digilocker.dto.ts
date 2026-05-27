import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class DownloadAadhaarDigilockerDto {
  @ApiPropertyOptional({
    description:
      'Session token from DigiLocker init. Omit when the server stored it (Redis) during init — callback can recover via GET /auth/digilocker/pending-session.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  sessionToken?: string;

  @ApiPropertyOptional({ description: 'Consent for vendor (default true)' })
  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}
