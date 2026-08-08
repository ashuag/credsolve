import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LOAN_STATUS } from '../../common/constants/loan.constants';
import { istCalendarDateUtc } from '../../common/loan/loan-calculation.util';
import { PrismaService } from '../../prisma/prisma.service';

function isLoanOverdueCronEnabled(): boolean {
  const raw = process.env.LOAN_OVERDUE_CRON_ENABLED?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

@Injectable()
export class LoanOverdueCronService implements OnModuleInit {
  private readonly logger = new Logger(LoanOverdueCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (!isLoanOverdueCronEnabled()) {
      this.logger.warn('In-app loan overdue cron is disabled (LOAN_OVERDUE_CRON_ENABLED=false).');
      return;
    }
    this.logger.log('In-app loan overdue cron registered (daily at 00:00 Asia/Kolkata).');
  }

  /** Runs at midnight IST — ACTIVE open loans past maturity become OVERDUE. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Kolkata' })
  async handleDailyLoanOverdue(): Promise<void> {
    if (!isLoanOverdueCronEnabled()) {
      return;
    }
    await this.markPastDueLoansOverdue();
  }

  /**
   * Mark open ACTIVE loans whose maturity date is before today's IST calendar day as OVERDUE.
   * Maturity day itself stays ACTIVE (same rule as `isRepaymentPastDue`).
   */
  async markPastDueLoansOverdue(asOf: Date = new Date()): Promise<number> {
    const overdueStatus = await this.prisma.client.loanStatus.findFirst({
      where: { name: LOAN_STATUS.OVERDUE, isActive: true },
      select: { id: true },
    });

    if (!overdueStatus) {
      this.logger.error(`Loan status ${LOAN_STATUS.OVERDUE} is missing — skip overdue pass.`);
      return 0;
    }

    const todayIst = istCalendarDateUtc(asOf);

    const result = await this.prisma.client.loanAccount.updateMany({
      where: {
        closedAt: null,
        loanMaturityDate: { lt: todayIst },
        loanStatus: { name: LOAN_STATUS.ACTIVE },
      },
      data: {
        loanStatusId: overdueStatus.id,
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Marked ${result.count} ACTIVE loan(s) as OVERDUE (loan_maturity_date < ${todayIst.toISOString().slice(0, 10)} IST).`,
      );
    } else {
      this.logger.log(
        `No ACTIVE loans past maturity (loan_maturity_date < ${todayIst.toISOString().slice(0, 10)} IST).`,
      );
    }

    return result.count;
  }
}
