import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type EasebuzzNotificationSource = 'webhook' | 'surl' | 'furl' | 'easycollect';

function asField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

@Injectable()
export class EasebuzzRepaymentNotificationService {
  private readonly logger = new Logger(EasebuzzRepaymentNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Persist the exact inbound Easebuzz payload before we process it. */
  async begin(source: EasebuzzNotificationSource, payload: Record<string, unknown>): Promise<bigint | null> {
    try {
      const now = new Date();
      const uuid = randomUUID();
      await this.prisma.client.$executeRaw`
        INSERT INTO easebuzz_repayment_notification (
          uuid,
          source,
          txnid,
          easepayid,
          status,
          amount,
          payload,
          created_at,
          updated_at
        ) VALUES (
          ${uuid},
          ${source},
          ${asField(payload, 'txnid').slice(0, 64)},
          ${asField(payload, 'easepayid').slice(0, 64) || null},
          ${asField(payload, 'status').slice(0, 40) || null},
          ${asField(payload, 'amount').slice(0, 20) || null},
          ${jsonText(payload)},
          ${now},
          ${now}
        )
      `;
      const rows = await this.prisma.client.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM easebuzz_repayment_notification
        WHERE uuid = ${uuid}
        LIMIT 1
      `;
      return rows[0]?.id ?? null;
    } catch (error) {
      this.logger.warn(
        `[repay-notify] Could not persist inbound ${source}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async attachLoan(id: bigint | null, loanAccountId: bigint): Promise<void> {
    if (id == null) return;
    try {
      await this.prisma.client.$executeRaw`
        UPDATE easebuzz_repayment_notification
        SET loan_account_id = ${loanAccountId}, updated_at = ${new Date()}
        WHERE id = ${id}
      `;
    } catch (error) {
      this.logger.warn(
        `[repay-notify] Could not attach loan id=${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async attachConfirm(id: bigint | null, confirm: unknown): Promise<void> {
    if (id == null) return;
    try {
      await this.prisma.client.$executeRaw`
        UPDATE easebuzz_repayment_notification
        SET confirm_payload = ${jsonText(confirm)}, updated_at = ${new Date()}
        WHERE id = ${id}
      `;
    } catch (error) {
      this.logger.warn(
        `[repay-notify] Could not attach confirm id=${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async finish(
    id: bigint | null,
    outcome: { txnid?: string; result: string; code?: string },
  ): Promise<void> {
    if (id == null) return;
    try {
      const txnid = (outcome.txnid ?? '').slice(0, 64);
      await this.prisma.client.$executeRaw`
        UPDATE easebuzz_repayment_notification
        SET
          txnid = CASE WHEN ${txnid} = '' THEN txnid ELSE ${txnid} END,
          process_result = ${outcome.result.slice(0, 20)},
          process_code = ${outcome.code?.slice(0, 64) ?? null},
          updated_at = ${new Date()}
        WHERE id = ${id}
      `;
    } catch (error) {
      this.logger.warn(
        `[repay-notify] Could not finish id=${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
