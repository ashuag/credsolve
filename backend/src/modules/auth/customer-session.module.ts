import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';
import { CustomerAuthService } from './services/customer-auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [CustomerAuthService, CustomerJwtGuard],
  exports: [JwtModule, CustomerAuthService, CustomerJwtGuard],
})
export class CustomerSessionModule {}
