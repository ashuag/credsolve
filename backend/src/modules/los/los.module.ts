import { Module } from '@nestjs/common';
import { LosAuthController } from './auth/los-auth.controller';
import { LosAuthService } from './auth/los-auth.service';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosSessionService } from './auth/los-session.service';
import { LosDataController } from './los-data.controller';
import { LosDataService } from './los-data.service';
import { LosMastersController } from './los-masters.controller';
import { LosTeamController } from './los-team.controller';
import { LosTeamService } from './los-team.service';

@Module({
  controllers: [LosAuthController, LosDataController, LosMastersController, LosTeamController],
  providers: [LosAuthService, LosSessionService, LosAuthGuard, LosDataService, LosTeamService],
})
export class LosModule {}
