import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class OtpConfigurationException extends AppException {
  constructor(resource: string) {
    super(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'OTP configuration is incomplete.',
      'OTP_CONFIGURATION_MISSING',
      { resource }
    );
  }
}
