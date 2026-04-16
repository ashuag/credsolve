import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { LookupsModule } from '../lookups/lookups.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ApplicationModule } from '../application/application.module';
import { LosApplicationsController } from './applications/los-applications.controller';
import { LosApplicationsService } from './applications/los-applications.service';
import { LosAuthController } from './auth/los-auth.controller';
import { LosAuthService } from './auth/los-auth.service';
import { LosDashboardController } from './dashboard/los-dashboard.controller';
import { LosDashboardService } from './dashboard/los-dashboard.service';
import { LosLeadsController } from './leads/los-leads.controller';
import { LosLeadsService } from './leads/los-leads.service';
import { LosMastersController } from './masters/los-masters.controller';
import { LosMastersService } from './masters/los-masters.service';
import { LosRolesController } from './roles/los-roles.controller';
import { LosRolesService } from './roles/los-roles.service';
import { LosUsersController } from './users/los-users.controller';
import { LosUserInvitationService } from './users/los-user-invitation.service';
import { LosUsersService } from './users/los-users.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    LookupsModule,
    forwardRef(() => ApplicationModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    LosAuthController,
    LosUsersController,
    LosRolesController,
    LosDashboardController,
    LosLeadsController,
    LosApplicationsController,
    LosMastersController,
  ],
  providers: [
    LosAuthService,
    LosUsersService,
    LosRolesService,
    LosUserInvitationService,
    LosDashboardService,
    LosLeadsService,
    LosApplicationsService,
    LosMastersService,
  ],
  exports: [LosAuthService],
})
export class LosModule {}
