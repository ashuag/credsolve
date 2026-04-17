import { RequestMethod, ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX, DEFAULT_PORT } from './common/constants/app.constants';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { cookieParserMiddleware } from './common/middleware/cookie-parser.middleware';
import { createCorsOriginMatcher } from './config/cors.config';
import { setupSwagger } from './config/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: 'auth/google/login', method: RequestMethod.GET },
      { path: 'auth/google/callback', method: RequestMethod.GET },
    ],
  });

  app.enableCors({
    origin: createCorsOriginMatcher(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.use(cookieParserMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  setupSwagger(app);

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);

  const publicBase = process.env.BACKEND_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (publicBase) {
    Logger.log(`🚀 Backend running on ${publicBase}`, 'Bootstrap');
    Logger.log(`📖 Swagger at ${publicBase}/${API_PREFIX}/docs`, 'Bootstrap');
  } else {
    Logger.log(`🚀 Backend listening on port ${port}`, 'Bootstrap');
    Logger.log(`📖 Swagger at /${API_PREFIX}/docs (set BACKEND_PUBLIC_BASE_URL for full URL in logs)`, 'Bootstrap');
  }
}

bootstrap();
