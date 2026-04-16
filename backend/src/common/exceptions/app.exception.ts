import { HttpException, HttpStatus } from '@nestjs/common';

export type AppExceptionDetails = Record<string, unknown>;

type AppExceptionResponse = {
  statusCode: number;
  message: string;
  errorCode: string;
  details?: AppExceptionDetails;
};

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    errorCode: string,
    details?: AppExceptionDetails
  ) {
    const response: AppExceptionResponse = {
      statusCode: status,
      message,
      errorCode,
      ...(details ? { details } : {})
    };

    super(response, status);
  }
}
