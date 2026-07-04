import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './common/storage/storage.module';
import { RedisModule } from './common/redis/redis.module';
import { IpReputationModule } from './common/ip-reputation/ip-reputation.module';
import { SmsModule } from './common/sms/sms.module';
import { VendorApiModule } from './common/vendor/vendor-api.module';
import { AuthModule } from './modules/auth/auth.module';
import { BureauModule } from './modules/bureau/bureau.module';
import { ContactModule } from './modules/contact/contact.module';
import { LosModule } from './modules/los/los.module';
import { CronModule } from './modules/cron/cron.module';
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
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    RedisModule,
    IpReputationModule,
    SmsModule,
    VendorApiModule,
    AuthModule,
    BureauModule,
    ContactModule,
    LosModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
