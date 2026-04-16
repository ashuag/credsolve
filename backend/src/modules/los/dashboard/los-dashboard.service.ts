import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class LosDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCrmDashboard() {
    const now = new Date();
    const startOfDay = new Date(now);
    const endOfDay = new Date(now);

    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const activeAgentsToday = await this.prisma.user.count({
      where: {
        isActive: true,
        registrationCompletedAt: { not: null },
        lastLoginAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return { activeAgentsToday };
  }
}
