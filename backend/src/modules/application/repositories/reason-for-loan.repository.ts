import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

type LoanReasonRow = {
  id: number;
  name: string;
};

@Injectable()
export class ReasonForLoanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(session?: DatabaseSession): Promise<LoanReasonRow[]> {
    const client = session?.tx ?? this.prisma;
    return client.reasonForLoan.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true
      }
    });
  }

  async findActiveById(id: number, session?: DatabaseSession): Promise<LoanReasonRow | null> {
    const client = session?.tx ?? this.prisma;
    return client.reasonForLoan.findFirst({
      where: {
        id,
        isActive: true
      },
      select: {
        id: true,
        name: true
      }
    });
  }
}
