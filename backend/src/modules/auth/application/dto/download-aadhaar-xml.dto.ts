import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class DownloadAadhaarXmlDto {
  @ApiProperty({ description: '6-digit OTP sent to the Aadhaar-registered mobile', example: '475720' })
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits.' })
  otp!: string;
}
