import { Global, Module } from '@nestjs/common';
import { DatabaseTransactionService } from './database-transaction.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseTransactionService],
  exports: [PrismaService, DatabaseTransactionService]
})
export class PrismaModule {}
