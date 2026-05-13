import { Module } from '@nestjs/common';
import { BreCheckService } from './bre-check.service';

@Module({
  providers: [BreCheckService],
  exports: [BreCheckService],
})
export class BreModule {}
