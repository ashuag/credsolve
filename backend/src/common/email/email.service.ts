import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

/**
 * Shared SMTP email sender. Reads `SMTP_*`, `MAIL_FROM_*` from the environment (typically
 * `backend/.env` — see `src/load-env.ts` and `ConfigModule` in `app.module.ts`).
 * If `SMTP_HOST` is unset, {@link isConfigured} is false and OTP email is skipped (dev/console flow).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      this.transporter = null;
      return;
    }

    const port = Number.parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10) || 587;
    const secure =
      this.config.get<string>('SMTP_SECURE')?.trim().toLowerCase() === 'true' || port === 465;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';

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

    this.logger.log(
      `SMTP transport: ${host}:${port} secure=${secure} connectionTimeoutMs=${connectionTimeoutMs}` +
        `${family !== undefined ? ` family=${family}` : ''}`,
    );
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** For error logs only (no credentials). */
  smtpEndpointLabel(): string | null {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) return null;
    const port = Number.parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10) || 587;
    return `${host}:${port}`;
  }

  private formatFrom(): string {
    const name = this.config.get<string>('MAIL_FROM_NAME')?.trim() || 'MoneyCash';
    const addr =
      this.config.get<string>('MAIL_FROM_ADDRESS')?.trim()
      || this.config.get<string>('SMTP_USER')?.trim();
    if (!addr) {
      throw new Error('Set MAIL_FROM_ADDRESS or SMTP_USER for outbound email.');
    }
    return `"${name}" <${addr}>`;
  }

  /**
   * Sends an email. Throws if SMTP is not configured or delivery fails.
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transport is not configured (set SMTP_HOST).');
    }

    const from = this.formatFrom();

    await this.transporter.sendMail({
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
    });
  }

  /**
   * OTP email body used by {@link SendOtpUseCase} for `email` channel.
   */
  async sendOtpEmail(to: string, code: string, expiresAt: Date): Promise<void> {
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

    await this.sendEmail({ to, subject, text, html });
  }

  /**
   * Sends accepted loan documents (Key Fact Statement + Loan Agreement) after OTP acceptance.
   */
  async sendLoanDocumentsEmail(to: string, attachments: EmailAttachment[]): Promise<void> {
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

    await this.sendEmail({ to, subject, text, html, attachments });
  }
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

/** Prefer IPv4 on some cloud hosts where IPv6 to the MX hangs until TCP timeout. */
function parseSocketFamily(raw: string | undefined): number | undefined {
  const t = raw?.trim().toLowerCase();
  if (t === '4' || t === 'ipv4') return 4;
  if (t === '6' || t === 'ipv6') return 6;
  return undefined;
}
