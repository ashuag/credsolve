import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsString, Matches } from 'class-validator';

export class GenerateAadhaarXmlOtpDto {
  @ApiProperty({ description: '12-digit Aadhaar number', example: '844123451847' })
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar number must be 12 digits.' })
  aadhaarNumber!: string;

  @ApiProperty({ description: 'Customer consent to fetch Aadhaar via OTP', example: true })
  @IsBoolean()
  @Equals(true, { message: 'Consent is required to fetch Aadhaar details.' })
  consent!: boolean;
}
