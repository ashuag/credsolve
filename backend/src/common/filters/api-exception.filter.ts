import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { errorWithStack } from '../logging/logger.utils';

type JsonResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
};

type ApiRequest = {
  method?: string;
  url?: string;
};

function isDevelopmentEnvironment() {
  const environment = process.env.NODE_ENV?.trim().toLowerCase();
  return environment === 'dev' || environment === 'development';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<JsonResponse>();
    const request = context.getRequest<ApiRequest>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      response.status(status).json(
        typeof exceptionResponse === 'string'
          ? {
              statusCode: status,
              message: exceptionResponse
            }
          : exceptionResponse
      );
      return;
    }

    const isDev = isDevelopmentEnvironment();
    const error = exception instanceof Error ? exception : new Error('Internal server error');

    errorWithStack(this.logger, `${request.method} ${request.url} failed`, error);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isDev ? error.message : 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
      ...(isDev
        ? {
            details: {
              name: error.name,
              stack: error.stack
            }
          }
        : {})
    });
  }
}
