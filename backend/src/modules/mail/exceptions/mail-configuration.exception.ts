import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class MailConfigurationException extends AppException {
  constructor(resource: string) {
    super(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Email service is not configured.',
      'MAIL_CONFIGURATION_MISSING',
      { resource }
    );
  }
}
