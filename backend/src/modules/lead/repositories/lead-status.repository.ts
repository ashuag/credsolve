import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

@Injectable()
export class LeadStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveIdByName(name: string, session?: DatabaseSession): Promise<number | null> {
    const client = session?.tx ?? this.prisma;
    const leadStatus = await client.leadStatus.findFirst({
      where: { name, isActive: true },
      select: { id: true }
    });

    return leadStatus?.id ?? null;
  }
}
