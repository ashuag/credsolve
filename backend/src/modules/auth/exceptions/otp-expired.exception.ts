import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpExpiredException extends AppException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'OTP expired. Please request a fresh OTP.', 'OTP_EXPIRED');
  }
}
