import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SmsDlrWebhookPayload } from './sms-dlr.types';

function parseGatewayDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  // Gateway sends "YYYY-MM-DD HH:mm:ss" (IST-like, no timezone). Treat as local parse.
  const normalized = value.trim().includes('T') ? value.trim() : value.trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class SmsDlrWebhookService {
  private readonly logger = new Logger(SmsDlrWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleDeliveryReport(rawBody: unknown): Promise<{ matched: boolean; otpRequestUuid?: string }> {
    const payload = this.normalizePayload(rawBody);
    const messageId = asTrimmedString(payload.message_id);
    const correlationId = asTrimmedString(payload.correlation_id);
    const status = asTrimmedString(payload.status)?.toUpperCase() ?? null;
    const code = asTrimmedString(payload.code);

    if (!messageId && !correlationId) {
      this.logger.warn('[sms-dlr] Ignoring DLR without message_id and correlation_id');
      return { matched: false };
    }

    const otpRequest = await this.findOtpRequest({ messageId, correlationId });
    if (!otpRequest) {
      this.logger.warn(
        `[sms-dlr] No otp_request for message_id=${messageId ?? '-'} correlation_id=${correlationId ?? '-'} status=${status ?? '-'}`,
      );
      return { matched: false };
    }

    const dlrReceivedAt =
      parseGatewayDate(payload.dlr_received_at) ?? new Date();
    const submitAt = parseGatewayDate(payload.submit_at);

    await this.prisma.client.otpRequest.update({
      where: { id: otpRequest.id },
      data: {
        smsMessageId: messageId ?? otpRequest.smsMessageId,
        smsDeliveryStatus: status,
        smsDeliveryCode: code,
        smsSubmitAt: submitAt,
        smsDlrReceivedAt: dlrReceivedAt,
        smsDlrPayload: payload as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `[sms-dlr] Updated otp_request uuid=${otpRequest.uuid} status=${status ?? '-'} code=${code ?? '-'} message_id=${messageId ?? '-'}`,
    );

    return { matched: true, otpRequestUuid: otpRequest.uuid };
  }

  private normalizePayload(rawBody: unknown): SmsDlrWebhookPayload {
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return {};
    }
    return rawBody as SmsDlrWebhookPayload;
  }

  private findOtpRequest(input: { messageId: string | null; correlationId: string | null }) {
    if (input.correlationId) {
      return this.prisma.client.otpRequest.findUnique({
        where: { uuid: input.correlationId },
        select: { id: true, uuid: true, smsMessageId: true },
      });
    }
    if (input.messageId) {
      return this.prisma.client.otpRequest.findFirst({
        where: { smsMessageId: input.messageId },
        orderBy: { lastSentAt: 'desc' },
        select: { id: true, uuid: true, smsMessageId: true },
      });
    }
    return Promise.resolve(null);
  }
}
