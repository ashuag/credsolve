import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { KycFilesService } from '../../../../common/kyc/kyc-files.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';

@Injectable()
export class ServeCustomerNocPdfUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly prisma: PrismaService,
    private readonly kycFiles: KycFilesService,
  ) {}

  async execute(req: Request, res: Response, applicationUuid: string): Promise<void> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) throw new UnauthorizedException('Customer not found.');

    const application = await this.prisma.read.application.findFirst({
      where: { uuid: applicationUuid, customerId: customer.id },
      select: {
        loanAccount: {
          select: {
            isNocSent: true,
            nocPdfRelativePath: true,
            nocLetterNumber: true,
            loanNumber: true,
          },
        },
      },
    });
    if (!application?.loanAccount) {
      throw new NotFoundException('Loan not found.');
    }

    const loan = application.loanAccount;
    const rel = loan.nocPdfRelativePath?.trim() ?? '';
    if (!loan.isNocSent || !rel) {
      throw new NotFoundException('NOC letter has not been sent yet.');
    }

    let buf: Buffer;
    try {
      buf = await this.kycFiles.readBytes(rel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NoSuchKey') || msg.includes('S3 GET failed (404)')) {
        throw new NotFoundException('NOC letter file is missing from storage.');
      }
      throw err;
    }

    const fileName = `NOC-${loan.nocLetterNumber ?? loan.loanNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buf);
  }
}
