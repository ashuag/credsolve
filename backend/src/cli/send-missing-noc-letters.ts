/**
 * Send NOC / closure letters for fully paid loans that never got one.
 *
 * Targets: `closed_at` set, status CLOSED or SETTLED, `is_noc_sent` = false.
 * Idempotent — already-sent loans are skipped by NocLetterService.
 *
 * Build & run:
 *   npm run noc:send-missing
 *   npm run noc:send-missing -- --dry-run
 *   npm run noc:send-missing -- --limit=20
 *   npm run noc:send-missing -- --loan=APP2026K7M2Q
 *
 * Flags:
 *   --dry-run     List eligible loans only (no PDF / email / DB update)
 *   --limit=N     Process at most N loans (default: all)
 *   --loan=X      Only this loanNumber or loan uuid
 */
import '../load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LOAN_STATUS } from '../common/constants/loan.constants';
import { NocLetterService } from '../common/noc/noc-letter.service';
import { PrismaService } from '../prisma/prisma.service';

const LOG = 'send-missing-noc-letters';

type CliOptions = {
  dryRun: boolean;
  limit: number | null;
  loanFilter: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let limit: number | null = null;
  let loanFilter: string | null = null;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length));
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      limit = Math.floor(n);
      continue;
    }
    if (arg.startsWith('--loan=')) {
      const v = arg.slice('--loan='.length).trim();
      if (!v) throw new Error('Empty --loan value');
      loanFilter = v;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node build/src/cli/send-missing-noc-letters.js [--dry-run] [--limit=N] [--loan=LOAN_NUMBER|UUID]
`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, limit, loanFilter };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const noc = app.get(NocLetterService);

    const loans = await prisma.client.loanAccount.findMany({
      where: {
        isNocSent: false,
        closedAt: { not: null },
        loanStatus: {
          name: { in: [LOAN_STATUS.CLOSED, LOAN_STATUS.SETTLED] },
        },
        ...(opts.loanFilter
          ? {
              OR: [{ loanNumber: opts.loanFilter }, { uuid: opts.loanFilter }],
            }
          : {}),
      },
      select: {
        id: true,
        uuid: true,
        loanNumber: true,
        closedAt: true,
        loanStatus: { select: { name: true } },
        application: {
          select: {
            details: { select: { emailId: true } },
            lead: {
              select: {
                leadDetail: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { closedAt: 'asc' },
      ...(opts.limit != null ? { take: opts.limit } : {}),
    });

    Logger.log(
      `Found ${loans.length} fully paid loan(s) missing NOC` +
        (opts.dryRun ? ' (dry-run)' : '') +
        (opts.limit != null ? ` (limit=${opts.limit})` : '') +
        (opts.loanFilter ? ` (loan=${opts.loanFilter})` : ''),
      LOG,
    );

    if (loans.length === 0) {
      return;
    }

    let ok = 0;
    let failed = 0;

    for (const loan of loans) {
      const email = loan.application.details?.emailId?.trim() || '(no email)';
      const name = loan.application.lead.leadDetail?.fullName?.trim() || 'Customer';
      const closedLabel = loan.closedAt?.toISOString() ?? '—';

      if (opts.dryRun) {
        Logger.log(
          `[dry-run] ${loan.loanNumber} status=${loan.loanStatus.name} closedAt=${closedLabel} to=${email} name=${name}`,
          LOG,
        );
        ok += 1;
        continue;
      }

      Logger.log(`Issuing NOC for ${loan.loanNumber} → ${email}`, LOG);
      const sent = await noc.issueIfNeeded(loan.id);
      if (sent) {
        ok += 1;
        Logger.log(`OK ${loan.loanNumber}`, LOG);
      } else {
        failed += 1;
        Logger.warn(`FAILED ${loan.loanNumber}`, LOG);
      }
    }

    Logger.log(
      `Done. ${opts.dryRun ? 'Listed' : 'Sent'}=${ok}` +
        (opts.dryRun ? '' : ` failed=${failed}`) +
        ` total=${loans.length}`,
      LOG,
    );

    if (!opts.dryRun && failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
