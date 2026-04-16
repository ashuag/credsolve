import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { type DatabaseSession } from './database-session';

@Injectable()
export class DatabaseTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async runInTransaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => operation({ tx }));
  }
}
