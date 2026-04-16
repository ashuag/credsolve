import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class InvalidOtpException extends AppException {
  constructor(remainingAttempts: number) {
    super(
      HttpStatus.BAD_REQUEST,
      remainingAttempts > 0
        ? 'Invalid OTP. Please try again.'
        : 'Invalid OTP. No attempts remaining for this request.',
      'INVALID_OTP',
      { remainingAttempts }
    );
  }
}
