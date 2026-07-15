import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

type ContactSubmissionRow = {
  id: bigint;
  uuid: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

export type ContactSubmissionView = {
  id: string;
  uuid: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private map(row: ContactSubmissionRow): ContactSubmissionView {
    return {
      id: row.id.toString(),
      uuid: row.uuid,
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      message: row.message,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private resolveContactUsEmail(): string | null {
    const raw = this.config.get<string>('CONTACT_US_EMAIL')?.trim();
    return raw || null;
  }

  async create(
    dto: CreateContactSubmissionDto,
    meta: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ uuid: string }> {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const subject = dto.subject.trim();
    const message = dto.message.trim();

    const row = await this.prisma.client.contactSubmission.create({
      data: {
        name,
        email,
        phone,
        subject,
        message,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      },
      select: { uuid: true },
    });

    await this.notifyContactUsInbox({
      uuid: row.uuid,
      name,
      email,
      phone,
      subject,
      message,
    });

    return { uuid: row.uuid };
  }

  private async notifyContactUsInbox(submission: {
    uuid: string;
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const to = this.resolveContactUsEmail();
    if (!to) {
      this.logger.warn(
        `CONTACT_US_EMAIL is not set; skipping inbox notification for ${submission.uuid}`,
      );
      return;
    }
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `Email transport is not configured; skipping inbox notification for ${submission.uuid}`,
      );
      return;
    }

    try {
      await this.emailService.sendContactUsNotificationEmail(to, submission);
    } catch (error) {
      // Keep the public form success path; submission is already stored for LOS.
      this.logger.error(
        `Failed to email contact submission ${submission.uuid} to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async listForLos(): Promise<{ submissions: ContactSubmissionView[] }> {
    const rows = await this.prisma.client.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });
    return { submissions: rows.map((row) => this.map(row)) };
  }

  async markRead(uuid: string, isRead: boolean): Promise<ContactSubmissionView> {
    const row = await this.prisma.client.contactSubmission.update({
      where: { uuid },
      data: { isRead },
      select: {
        id: true,
        uuid: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });
    return this.map(row);
  }
}
