import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpAlreadyUsedException extends AppException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'OTP already verified. Please request a fresh OTP.', 'OTP_ALREADY_VERIFIED');
  }
}
