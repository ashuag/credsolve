import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class InitDigilockerDto {
  /**
   * Where DigiLocker sends the user after login (must match an allowed prefix from env).
   * Example: `http://localhost:3021/kyc/digilocker-callback`
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  redirectUrl?: string;
}
