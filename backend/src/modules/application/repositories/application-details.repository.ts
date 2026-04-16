import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

@Injectable()
export class ApplicationDetailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertLoanOfferDetails(params: {
    applicationId: bigint;
    reasonForLoanId: number;
    loanAmount: number;
    loanTenure: number;
    interestRate: number;
    interestAmount: number;
    processingFee: number;
    processingFeeAmount: number;
    gstAmount: number;
    loanDisbursementDate: Date;
    loanMaturityDate: Date;
  }, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;

    await client.applicationDetails.upsert({
      where: { applicationId: params.applicationId },
      update: {
        reasonForLoan: {
          connect: { id: params.reasonForLoanId }
        },
        loanAmount: new Prisma.Decimal(params.loanAmount),
        loanTenure: params.loanTenure,
        interestRate: new Prisma.Decimal(params.interestRate),
        interestAmount: new Prisma.Decimal(params.interestAmount),
        processingFee: new Prisma.Decimal(params.processingFee),
        processingFeeAmount: new Prisma.Decimal(params.processingFeeAmount),
        gstAmount: new Prisma.Decimal(params.gstAmount),
        loanDisbursementDate: params.loanDisbursementDate,
        loanMaturityDate: params.loanMaturityDate
      },
      create: {
        application: {
          connect: { id: params.applicationId }
        },
        reasonForLoan: {
          connect: { id: params.reasonForLoanId }
        },
        loanAmount: new Prisma.Decimal(params.loanAmount),
        loanTenure: params.loanTenure,
        interestRate: new Prisma.Decimal(params.interestRate),
        interestAmount: new Prisma.Decimal(params.interestAmount),
        processingFee: new Prisma.Decimal(params.processingFee),
        processingFeeAmount: new Prisma.Decimal(params.processingFeeAmount),
        gstAmount: new Prisma.Decimal(params.gstAmount),
        loanDisbursementDate: params.loanDisbursementDate,
        loanMaturityDate: params.loanMaturityDate
      }
    });
  }
}
