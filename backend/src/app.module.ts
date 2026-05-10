import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { LosModule } from './modules/los/los.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), 'backend', '.env'),
        // Same file `load-env.ts` resolves when cwd is not `backend/` (Nest compiled lives in `build/src/`).
        join(__dirname, '..', '..', '.env'),
      ].filter((p) => existsSync(p)),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    LosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
