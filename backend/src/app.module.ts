import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { LosModule } from './modules/los/los.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    LookupsModule,
    LosModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
