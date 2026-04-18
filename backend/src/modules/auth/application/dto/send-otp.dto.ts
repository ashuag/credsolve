import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OTP_TYPE, type OtpType } from '../../../../common/constants/otp.constants';

export class SendOtpDto {
  @ApiProperty({ enum: [OTP_TYPE.MOBILE, OTP_TYPE.EMAIL], example: OTP_TYPE.MOBILE })
  @IsString()
  @IsIn([OTP_TYPE.MOBILE, OTP_TYPE.EMAIL])
  type!: OtpType;

  @ApiProperty({
    description: 'Mobile digits (10) or email address, depending on `type`.',
    oneOf: [{ type: 'string' }, { type: 'number' }],
    example: 9876543210,
  })
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmTerm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmContent?: string;
}
