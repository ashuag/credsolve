import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Length, Matches } from 'class-validator';
import { OTP_TYPE, type OtpType } from '../../../../common/constants/otp.constants';

export class VerifyOtpDto {
  @ApiProperty({ enum: [OTP_TYPE.MOBILE, OTP_TYPE.EMAIL] })
  @IsString()
  @IsIn([OTP_TYPE.MOBILE, OTP_TYPE.EMAIL])
  type!: OtpType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ minLength: 4, maxLength: 8, example: '123456' })
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/)
  otpCode!: string;
}
