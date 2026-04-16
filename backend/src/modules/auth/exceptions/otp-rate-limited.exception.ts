import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpRateLimitedException extends AppException {
  constructor(retryAfterSeconds: number) {
    super(
      HttpStatus.TOO_MANY_REQUESTS,
      'Too many attempts. Try again after some times.',
      'OTP_RATE_LIMITED',
      { retryAfterSeconds }
    );
  }
}
