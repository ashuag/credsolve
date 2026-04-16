import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpAttemptsExceededException extends AppException {
  constructor() {
    super(
      HttpStatus.TOO_MANY_REQUESTS,
      'Too many invalid OTP attempts. Please request a fresh OTP.',
      'OTP_ATTEMPTS_EXCEEDED'
    );
  }
}
