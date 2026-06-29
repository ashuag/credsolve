import { Injectable, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { verifyKycLivenessSelfieAccessToken } from '../../../../common/kyc/kyc-liveness-selfie-token.util';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class ServeKycLivenessSelfieVendorUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kycFiles: KycFilesService,
  ) {}

  async execute(req: Request, res: Response): Promise<void> {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const parsed = verifyKycLivenessSelfieAccessToken(token);
    if (!parsed) {
      throw new NotFoundException('Invalid or expired selfie link.');
    }

    const application = await this.prisma.client.application.findUnique({
      where: { uuid: parsed.applicationUuid },
      select: { kyc: { select: { livenessSelfiePath: true } } },
    });

    const rel = application?.kyc?.livenessSelfiePath?.trim();
    if (!rel) {
      throw new NotFoundException('Selfie is not saved yet.');
    }

    const buf = await this.kycFiles.readBytes(rel);
    const lower = rel.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }
}
