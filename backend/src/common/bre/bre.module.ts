import { Module } from '@nestjs/common';
import { PostBreCheckService } from './post-bre-check.service';
import { PreBreCheckService } from './pre-bre-check.service';

@Module({
  providers: [PreBreCheckService, PostBreCheckService],
  exports: [PreBreCheckService, PostBreCheckService],
})
export class BreModule {}
