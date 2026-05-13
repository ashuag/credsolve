import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class DownloadAadhaarDigilockerDto {
  @ApiProperty({ description: 'Session token returned by the DigiLocker generate-URL step' })
  @IsString()
  @MinLength(8)
  sessionToken!: string;

  @ApiPropertyOptional({ description: 'Consent for vendor (default true)' })
  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}
