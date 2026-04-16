import { RequestMethod, ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || req.path.includes('/auth/send-otp')) {
      // #region agent log
      fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'pre-fix',hypothesisId:'H1_H3',location:'backend/src/main.ts:29',message:'Incoming request at backend',data:{method:req.method,path:req.path,origin:req.headers.origin,acrMethod:req.headers['access-control-request-method'],acrHeaders:req.headers['access-control-request-headers']},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      res.on('finish', () => {
        // #region agent log
        fetch('http://127.0.0.1:7639/ingest/a8665698-2866-40f5-889d-a7ac7451a90b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ec50e'},body:JSON.stringify({sessionId:'1ec50e',runId:'pre-fix',hypothesisId:'H4',location:'backend/src/main.ts:33',message:'Backend response completed',data:{method:req.method,path:req.path,statusCode:res.statusCode,allowOrigin:res.getHeader('access-control-allow-origin'),allowMethods:res.getHeader('access-control-allow-methods'),allowHeaders:res.getHeader('access-control-allow-headers')},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      });
    }
    next();
  });

  app.use(cookieParserMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  setupSwagger(app);

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);

  Logger.log(`🚀 Backend running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📖 Swagger at http://localhost:${port}/${API_PREFIX}/docs`, 'Bootstrap');
}

bootstrap();
