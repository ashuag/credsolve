import { ApiProperty } from '@nestjs/swagger';
import { OTP_TYPE, type OtpType } from '../../../../common/constants/otp.constants';

export class GetOtpTypesResponseDto {
  @ApiProperty({ enum: OTP_TYPE, isArray: true, example: [OTP_TYPE.MOBILE, OTP_TYPE.EMAIL] })
  values!: OtpType[];
}
