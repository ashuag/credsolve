/**
 * One-shot lead expiry job (for system crontab or manual runs).
 *
 * Build & run:
 *   npm run cron:expire-leads
 *
 * Crontab example (daily 00:05 IST — adjust path and node):
 *   5 0 * * * cd /path/to/moneyCash/backend && /usr/bin/npm run cron:expire-leads >> /var/log/moneycash-lead-expiry.log 2>&1
 *
 * When using in-app @nestjs/schedule instead, set LEAD_EXPIRY_CRON_ENABLED=false
 * to avoid running twice.
 */
import '../load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LeadExpiryCronService } from '../modules/cron/lead-expiry.cron.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const count = await app.get(LeadExpiryCronService).expireStaleLeads();
    Logger.log(`Lead expiry complete: ${count} lead(s) processed.`, 'expire-leads');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
