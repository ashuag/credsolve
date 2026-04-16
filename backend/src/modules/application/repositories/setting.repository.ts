import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

@Injectable()
export class SettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveValuesByKeys(keys: string[], session?: DatabaseSession): Promise<Record<string, string>> {
    const client = session?.tx ?? this.prisma;
    const rows = await client.setting.findMany({
      where: {
        isActive: true,
        key: { in: keys }
      },
      select: {
        key: true,
        value: true
      }
    });

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
}
