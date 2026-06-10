import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { SentMessageInfo, Transporter } from 'nodemailer';
import { VENDOR_HTTP_METHOD } from '../constants/vendor-http-method.constants';
import { VendorApiService } from '../vendor/vendor-api.service';
import {
  buildEmailAuditRequestPayload,
  buildEmailSmtpAuditPath,
  resolveEmailProviderName,
} from './email-vendor-audit.util';
import {
  isEmailConfigured,
  resolveEmailFromConfig,
  resolveEmailTransportConfig,
  shouldUseZeptomailEmailApi,
} from './email-env.util';
import type { EmailAttachment, SendEmailAuditContext, SendEmailOptions } from './email.types';
import { ZeptomailEmailVendorService } from './zeptomail-email-vendor.service';

export type { EmailAttachment, SendEmailAuditContext, SendEmailOptions };

/**
 * Outbound email via Zeptomail REST API (preferred when `EMAIL_PROVIDER=zeptomail`)
 * or legacy SMTP nodemailer. Audited to `vendor_api_log` on every send.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly transportConfig: ReturnType<typeof resolveEmailTransportConfig>;
  private readonly useZeptomailApi: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly vendorApi: VendorApiService,
    private readonly zeptomailEmail: ZeptomailEmailVendorService,
  ) {
    this.transportConfig = resolveEmailTransportConfig(config);
    this.useZeptomailApi = shouldUseZeptomailEmailApi(config);

    if (this.useZeptomailApi || !this.transportConfig) {
      this.transporter = null;
      if (this.useZeptomailApi) {
        this.logger.log(`Email transport: Zeptomail REST API (${this.zeptomailEmail.isConfigured() ? 'configured' : 'missing token/from'})`);
      }
      return;
    }

    const { host, port, secure, user, pass } = this.transportConfig;

    const connectionTimeoutMs = parsePositiveInt(this.config.get<string>('SMTP_CONNECTION_TIMEOUT_MS'), 25_000);
    const socketTimeoutMs = parsePositiveInt(this.config.get<string>('SMTP_SOCKET_TIMEOUT_MS'), 60_000);
    const family = parseSocketFamily(this.config.get<string>('SMTP_FAMILY'));

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      connectionTimeout: connectionTimeoutMs,
      socketTimeout: socketTimeoutMs,
      ...(family !== undefined ? { family } : {}),
      ...(user ? { auth: { user, pass } } : {}),
    });

    const providerLabel = this.transportConfig.provider ?? 'smtp';
    this.logger.log(
      `Email transport (${providerLabel} SMTP): ${host}:${port} secure=${secure} connectionTimeoutMs=${connectionTimeoutMs}` +
        `${family !== undefined ? ` family=${family}` : ''}`,
    );
  }

  isConfigured(): boolean {
    if (this.useZeptomailApi) {
      return this.zeptomailEmail.isConfigured();
    }
    return this.transporter !== null;
  }

  /** For error logs only (no credentials). */
  smtpEndpointLabel(): string | null {
    if (this.useZeptomailApi) {
      return isEmailConfigured(this.config) ? 'zeptomail-api' : null;
    }
    if (!this.transportConfig) return null;
    return `${this.transportConfig.host}:${this.transportConfig.port}`;
  }

  private formatFrom(): string {
    const cfg = this.useZeptomailApi ? resolveEmailFromConfig(this.config) : this.transportConfig;
    if (!cfg?.fromAddress) {
      throw new Error('Set EMAIL_FROM, MAIL_FROM_ADDRESS, or SMTP_USER for outbound email.');
    }
    return `"${cfg.fromName}" <${cfg.fromAddress}>`;
  }

  /**
   * Sends an email. Throws if email is not configured or delivery fails.
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (this.useZeptomailApi) {
      await this.zeptomailEmail.send({
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
        attachments: options.attachments,
        audit: options.audit,
      });
      return;
    }

    await this.sendViaSmtp(options);
  }

  private async sendViaSmtp(options: SendEmailOptions): Promise<void> {
    if (!this.transporter || !this.transportConfig) {
      throw new Error('Email transport is not configured (set EMAIL_HOST or SMTP_HOST).');
    }

    const from = this.formatFrom();
    const requestedAt = new Date();
    const auditPath = buildEmailSmtpAuditPath(this.transportConfig.host, this.transportConfig.port);
    const providerName = resolveEmailProviderName(this.config);
    const serviceName = options.audit?.serviceName ?? 'email-send';
    const leadId = options.audit?.leadId ?? null;
    const attachmentNames = options.attachments?.map((a) => a.filename) ?? [];
    const requestPayload = buildEmailAuditRequestPayload({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachmentCount: options.attachments?.length ?? 0,
      attachmentNames,
    });

    try {
      const info = (await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
        ...(options.attachments?.length
          ? {
              attachments: options.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType ?? 'application/pdf',
              })),
            }
          : {}),
      })) as SentMessageInfo;

      this.vendorApi.auditOutboundCall({
        providerName,
        serviceName,
        requestMethod: VENDOR_HTTP_METHOD.POST,
        requestPath: auditPath,
        leadId,
        requestHeaders: {
          'content-type': 'message/rfc822',
          ...(this.transportConfig.user ? { 'smtp-auth-user': this.transportConfig.user } : {}),
        },
        requestPayload,
        responsePayload: serializeNodemailerResponse(info),
        httpStatus: 200,
        requestedAt,
        respondedAt: new Date(),
      });
    } catch (error) {
      const respondedAt = new Date();
      this.vendorApi.auditOutboundCall({
        providerName,
        serviceName,
        requestMethod: VENDOR_HTTP_METHOD.POST,
        requestPath: auditPath,
        leadId,
        requestHeaders: {
          'content-type': 'message/rfc822',
          ...(this.transportConfig.user ? { 'smtp-auth-user': this.transportConfig.user } : {}),
        },
        requestPayload,
        responsePayload: {
          error: error instanceof Error ? error.message : String(error),
        },
        httpStatus: null,
        requestedAt,
        respondedAt,
      });
      throw error;
    }
  }

  async sendOtpEmail(
    to: string,
    code: string,
    expiresAt: Date,
    audit?: Pick<SendEmailAuditContext, 'leadId'>,
  ): Promise<void> {
    const subject = 'Your MoneyCash verification code';
    const text = [
      `Your verification code is ${code}.`,
      `It expires at ${expiresAt.toISOString()} (UTC).`,
      '',
      'If you did not request this code, you can ignore this email.',
    ].join('\n');

    const html = `
      <p>Your verification code is <strong style="font-size:1.25em;letter-spacing:0.08em;">${escapeHtml(code)}</strong>.</p>
      <p style="color:#555;font-size:0.9em;">This code expires at ${escapeHtml(expiresAt.toISOString())} (UTC).</p>
      <p style="color:#555;font-size:0.85em;">If you did not request this code, you can ignore this email.</p>
    `.trim();

    await this.sendEmail({
      to,
      subject,
      text,
      html,
      audit: { serviceName: 'email-otp', leadId: audit?.leadId ?? null },
    });
  }

  async sendLoanDocumentsEmail(
    to: string,
    attachments: EmailAttachment[],
    audit?: Pick<SendEmailAuditContext, 'leadId'>,
  ): Promise<void> {
    const subject = 'Your MoneyCash loan documents';
    const text = [
      'Thank you for accepting your loan documents.',
      '',
      'Attached are your Sanction letter cum Key Fact Statement and Loan Agreement for your records.',
      '',
      'You can continue your application in the MoneyCash portal to complete KYC and bank verification.',
      '',
      'If you did not accept these documents, please contact support.',
    ].join('\n');

    const html = `
      <p>Thank you for accepting your loan documents.</p>
      <p>Attached are your <strong>Sanction letter cum Key Fact Statement</strong> and <strong>Loan Agreement</strong> for your records.</p>
      <p style="color:#555;font-size:0.9em;">You can continue your application in the MoneyCash portal to complete KYC and bank verification.</p>
      <p style="color:#555;font-size:0.85em;">If you did not accept these documents, please contact support.</p>
    `.trim();

    await this.sendEmail({
      to,
      subject,
      text,
      html,
      attachments,
      audit: { serviceName: 'email-loan-documents', leadId: audit?.leadId ?? null },
    });
  }
}

function serializeNodemailerResponse(info: SentMessageInfo): Record<string, unknown> {
  return {
    messageId: info.messageId ?? null,
    response: info.response ?? null,
    accepted: info.accepted ?? [],
    rejected: info.rejected ?? [],
    envelope: info.envelope ?? null,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseSocketFamily(raw: string | undefined): number | undefined {
  const t = raw?.trim().toLowerCase();
  if (t === '4' || t === 'ipv4') return 4;
  if (t === '6' || t === 'ipv6') return 6;
  return undefined;
}
