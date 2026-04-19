import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class BankRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveNames(): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<Array<{ name: string }>>`
      SELECT name
      FROM bank
      WHERE is_active = true
      ORDER BY name ASC
    `;

    return rows.map((row) => row.name);
  }

  async isActiveBankName(name: string): Promise<boolean> {
    const rows = await this.prisma.client.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM bank
      WHERE name = ${name} AND is_active = true
      LIMIT 1
    `;
    return rows.length > 0;
  }
}
