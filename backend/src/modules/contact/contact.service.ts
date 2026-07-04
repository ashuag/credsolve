import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

type ContactSubmissionRow = {
  id: bigint;
  uuid: string;
  name: string;
  email: string;
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
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: ContactSubmissionRow): ContactSubmissionView {
    return {
      id: row.id.toString(),
      uuid: row.uuid,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(
    dto: CreateContactSubmissionDto,
    meta: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ uuid: string }> {
    const row = await this.prisma.client.contactSubmission.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      },
      select: { uuid: true },
    });
    return { uuid: row.uuid };
  }

  async listForLos(): Promise<{ submissions: ContactSubmissionView[] }> {
    const rows = await this.prisma.client.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        name: true,
        email: true,
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
        subject: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });
    return this.map(row);
  }
}
