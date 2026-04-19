import 'reflect-metadata';
import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ensureApplicationTablesExist } from './prisma/ensure-application-schema';
import { PrismaService } from './prisma/prisma.service';

function parseCorsOrigins(): string[] | false {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return false;
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isProductionNodeEnv(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  app.use(
    helmet({
      // Swagger UI and some SPAs rely on inline scripts; keep API hardening without breaking /docs in dev.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    compression({
      threshold: 1024,
      level: 6,
    })
  );

  app.use(cookieParser());
  /**
   * Google Cloud "Authorized redirect URIs" sometimes omit the Nest global prefix.
   * Forward legacy paths into the real Nest routes under `/api/...`.
   */
  expressApp.get('/auth/google/callback', (req: Request, res: Response) => {
    res.redirect(307, `/api${req.originalUrl}`);
  });
  expressApp.get('/auth/google/login', (req: Request, res: Response) => {
    res.redirect(307, `/api${req.originalUrl}`);
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  const origins = parseCorsOrigins();
  if (origins !== false && origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MoneyCash API')
    .setDescription('HTTP API for MoneyCash (customer auth and future modules).')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const openApiEnabled =
    !isProductionNodeEnv() || (process.env.ENABLE_OPENAPI_DOCS ?? '').trim().toLowerCase() === 'true';
  if (openApiEnabled) {
    SwaggerModule.setup('docs', app, document);
  }

  const prisma = app.get(PrismaService);
  await ensureApplicationTablesExist(prisma.client);

  const port = Number.parseInt(process.env.PORT ?? '4001', 10);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(
    `[nest] listening on http://0.0.0.0:${port}` +
      (openApiEnabled ? ' (OpenAPI: /docs)' : ' (OpenAPI disabled in production; set ENABLE_OPENAPI_DOCS=true to enable)')
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
