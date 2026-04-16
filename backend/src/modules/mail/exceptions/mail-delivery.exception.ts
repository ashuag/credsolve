import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/exceptions/app.exception';

export class MailDeliveryException extends AppException {
  constructor() {
    super(
      HttpStatus.SERVICE_UNAVAILABLE,
      'Unable to send email right now. Please try again.',
      'MAIL_DELIVERY_FAILED'
    );
  }
}
