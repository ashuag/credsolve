import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.use(cookieParser());
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
  SwaggerModule.setup('docs', app, document);

  const prisma = app.get(PrismaService);
  await ensureApplicationTablesExist(prisma.client);

  const port = Number.parseInt(process.env.PORT ?? '4001', 10);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[nest] listening on http://0.0.0.0:${port} (OpenAPI: /docs)`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
