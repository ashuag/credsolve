import { Module } from '@nestjs/common';
import { PreBreCheckService } from './pre-bre-check.service';

@Module({
  providers: [PreBreCheckService],
  exports: [PreBreCheckService],
})
export class BreModule {}
