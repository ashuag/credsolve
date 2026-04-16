import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpResendTooSoonException extends AppException {
  constructor() {
    super(
      HttpStatus.TOO_MANY_REQUESTS,
      `Too many request, please try after some times.`,
      'OTP_RESEND_TOO_SOON'
    );
  }
}
