import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import {
  ACTIVE_LIVENESS_CHALLENGES,
  type ActiveLivenessChallenge,
} from '../../../common/kyc/kyc-active-liveness.util';

export class ActiveLivenessCheckDto {
  @ApiPropertyOptional({ enum: ['smooth', 'challenges'], default: 'challenges' })
  @IsOptional()
  @IsIn(['smooth', 'challenges'])
  mode?: 'smooth' | 'challenges';

  @ApiPropertyOptional({ enum: ACTIVE_LIVENESS_CHALLENGES })
  @ValidateIf((o: ActiveLivenessCheckDto) => (o.mode ?? 'challenges') === 'challenges')
  @IsIn(ACTIVE_LIVENESS_CHALLENGES as unknown as string[])
  challenge?: ActiveLivenessChallenge;

  /** JSON array of `{ phase: 'baseline'|'turn'|'smile', count: number }` for smooth mode. */
  @ApiPropertyOptional({
    description: 'JSON array of smooth-session segment metadata (baseline / turn / smile counts)',
  })
  @IsOptional()
  @IsString()
  smoothSegments?: string;
}
