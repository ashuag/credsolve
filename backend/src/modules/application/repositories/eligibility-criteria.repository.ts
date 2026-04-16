import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

export type EligibilityCriteriaRow = {
  id: number;
  key: string;
  label: string;
  value: string;
  description: string | null;
  isActive: boolean;
};

@Injectable()
export class EligibilityCriteriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(session?: DatabaseSession): Promise<EligibilityCriteriaRow[]> {
    const client = session?.tx ?? this.prisma;
    return client.eligibilityCriteria.findMany({
      where: { isActive: true },
      select: { id: true, key: true, label: true, value: true, description: true, isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async findAll(session?: DatabaseSession): Promise<EligibilityCriteriaRow[]> {
    const client = session?.tx ?? this.prisma;
    return client.eligibilityCriteria.findMany({
      select: { id: true, key: true, label: true, value: true, description: true, isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async updateById(
    id: number,
    data: { value?: string; isActive?: boolean },
    session?: DatabaseSession,
  ): Promise<EligibilityCriteriaRow> {
    const client = session?.tx ?? this.prisma;
    return client.eligibilityCriteria.update({
      where: { id },
      data,
      select: { id: true, key: true, label: true, value: true, description: true, isActive: true },
    });
  }
}
