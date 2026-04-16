import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';
import { OTP_TYPE, type OtpType } from '../../../common/constants/otp.constants';

export class InvalidOtpValueException extends AppException {
  constructor(type: OtpType) {
    super(
      HttpStatus.BAD_REQUEST,
      type === OTP_TYPE.MOBILE ? 'mobile Number is not valid.' : 'email must be a valid email address.',
      'INVALID_OTP_VALUE',
      { type }
    );
  }
}
