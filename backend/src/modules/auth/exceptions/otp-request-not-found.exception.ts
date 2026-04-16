import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpRequestNotFoundException extends AppException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'OTP request not found.', 'OTP_REQUEST_NOT_FOUND');
  }
}
