import './load-env';
import './instrument';
import 'reflect-metadata';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ensureApplicationTablesExist } from './prisma/ensure-application-schema';
import { PrismaService } from './prisma/prisma.service';

function isProductionNodeEnv(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

/** Browser `Origin` has no trailing slash; normalize so env can use either form. */
function parseCorsOrigins(): string[] | false {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return false;
  }
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const DEV_CORS_FALLBACK = [
  'http://localhost:3010',
  'http://localhost:3011',
  'http://localhost:3020',
  'http://localhost:3021',
  'http://localhost:4001',
  'http://127.0.0.1:3010',
  'http://127.0.0.1:3011',
  'http://127.0.0.1:3020',
  'http://127.0.0.1:3021',
  'http://127.0.0.1:4001',
  // `next dev --experimental-https` (or similar) — must match browser Origin exactly
  'https://localhost:3010',
  'https://localhost:3011',
  'https://localhost:3020',
  'https://localhost:3021',
  'https://127.0.0.1:3010',
  'https://127.0.0.1:3011',
  'https://127.0.0.1:3020',
  'https://127.0.0.1:3021',
] as const;

function resolveCorsOrigins(): string[] {
  const parsed = parseCorsOrigins();
  if (parsed !== false && parsed.length > 0) {
    return parsed;
  }
  if (!isProductionNodeEnv()) {
    return [...DEV_CORS_FALLBACK];
  }
  return [];
}

/** `nest start --watch` can respawn before the old HTTP server releases the port (esp. in Docker). */
async function listenWithBackoff(
  app: INestApplication,
  port: number,
  host: string,
  maxAttempts = 8
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await app.listen(port, host);
      return;
    } catch (err) {
      lastErr = err;
      const code = err && typeof err === 'object' && 'code' in err ? String((err as NodeJS.ErrnoException).code) : '';
      if (code !== 'EADDRINUSE' || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = Math.min(250 * 2 ** (attempt - 1), 4000);
      // eslint-disable-next-line no-console
      console.warn(`[nest] port ${port} busy (watch restart race?), retry ${attempt}/${maxAttempts} in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

function httpJsonBodyLimit(): string {
  const raw = process.env.HTTP_JSON_BODY_LIMIT?.trim();
  return raw || '15mb';
}

async function bootstrap() {
  const bodyLimit = httpJsonBodyLimit();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });
  app.enableShutdownHooks();
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

  const origins = resolveCorsOrigins();
  if (isProductionNodeEnv() && origins.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[nest] CORS_ORIGINS is missing or empty in production. Browser calls from your web app will fail CORS. ' +
        'Set a comma-separated list of exact origins (no path), e.g. ' +
        'CORS_ORIGINS=https://www.moneycash.in,https://moneycash.in,https://los.moneycash.in'
    );
  }
  if (origins.length > 0) {
    app.enableCors({
      origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!requestOrigin) {
          callback(null, true);
          return;
        }
        if (origins.includes(requestOrigin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
      maxAge: 86400,
    });
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
  const listenHost = (process.env.HOST ?? '127.0.0.1').trim() || '127.0.0.1';
  await listenWithBackoff(app, port, listenHost);
  // eslint-disable-next-line no-console
  console.log(
    `[nest] listening on http://${listenHost}:${port}` +
      (openApiEnabled ? ' (OpenAPI: /docs)' : ' (OpenAPI disabled in production; set ENABLE_OPENAPI_DOCS=true to enable)')
  );
}

bootstrap().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  Sentry.captureException(err);
  await Sentry.close(2000).catch(() => undefined);
  process.exit(1);
});
