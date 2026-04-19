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
      // Same keys as `src/load-env.ts`. Later files override earlier; `backend/.env` wins over cwd `.env`.
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), 'backend', '.env')],
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
