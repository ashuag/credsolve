/**
 * One-shot ACTIVE → OVERDUE job (for system crontab or manual runs).
 *
 * Build & run:
 *   npm run cron:mark-loans-overdue
 *
 * Crontab example (daily 00:05 IST — adjust path and node):
 *   5 0 * * * cd /path/to/moneyCash/backend && /usr/bin/npm run cron:mark-loans-overdue >> /var/log/moneycash-loan-overdue.log 2>&1
 *
 * When using in-app @nestjs/schedule instead, set LOAN_OVERDUE_CRON_ENABLED=false
 * to avoid running twice.
 */
import '../load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LoanOverdueCronService } from '../modules/cron/loan-overdue.cron.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const count = await app.get(LoanOverdueCronService).markPastDueLoansOverdue();
    Logger.log(`Loan overdue mark complete: ${count} loan(s) updated.`, 'mark-loans-overdue');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
