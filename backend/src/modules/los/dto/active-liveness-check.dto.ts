import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  ACTIVE_LIVENESS_CHALLENGES,
  type ActiveLivenessChallenge,
} from '../../../common/kyc/kyc-active-liveness.util';

export class ActiveLivenessCheckDto {
  @ApiProperty({ enum: ACTIVE_LIVENESS_CHALLENGES })
  @IsIn(ACTIVE_LIVENESS_CHALLENGES as unknown as string[])
  challenge!: ActiveLivenessChallenge;
}
