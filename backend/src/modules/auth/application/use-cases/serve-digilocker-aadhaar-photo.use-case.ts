import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { fetchLatestApplicationKycSnapshot } from '../../../../prisma/application-kyc-snapshot.query';
import { PrismaService } from '../../../../prisma/prisma.service';

export type DigilockerAadhaarPhotoData = {
  mimeType: 'image/jpeg' | 'image/png';
  base64: string;
};

@Injectable()
export class ServeDigilockerAadhaarPhotoUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly kycFiles: KycFilesService,
  ) {}

  private async loadPhotoBuffer(req: Request): Promise<{ mimeType: DigilockerAadhaarPhotoData['mimeType']; buf: Buffer }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }
    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) {
      throw new NotFoundException('No active application.');
    }

    const application = await fetchLatestApplicationKycSnapshot(this.prisma.client, {
      leadId: lead.id,
      customerId: customer.id,
    });
    const rel = application?.aadhaarPhotoRelativePath?.trim();
    if (!rel) {
      throw new NotFoundException('Aadhaar photo is not available yet.');
    }

    const buf = await this.kycFiles.readBytes(rel);
    const lower = rel.toLowerCase();
    const mimeType: DigilockerAadhaarPhotoData['mimeType'] = lower.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';
    return { mimeType, buf };
  }

  /** JSON payload for browser face-api (avoids flaky cookie auth on raw image GETs). */
  async executeJson(req: Request): Promise<DigilockerAadhaarPhotoData> {
    const { mimeType, buf } = await this.loadPhotoBuffer(req);
    return { mimeType, base64: buf.toString('base64') };
  }

  async execute(req: Request, res: Response): Promise<void> {
    const { mimeType, buf } = await this.loadPhotoBuffer(req);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(buf);
  }
}
