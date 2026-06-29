import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const DOC_SPECS = [
  { field: 'panDocument', name: 'PAN', displayName: 'PAN card' },
  { field: 'aadhaarFront', name: 'AADHAAR_FRONT', displayName: 'Aadhaar (front)' },
  { field: 'aadhaarBack', name: 'AADHAAR_BACK', displayName: 'Aadhaar (back)' },
] as const;

type DocField = (typeof DOC_SPECS)[number]['field'];

function assertUpload(file: UploadedFileLike | undefined, label: string): void {
  if (!file?.buffer?.length) {
    throw new BadRequestException(`Please upload ${label}.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException(`${label} must be 5MB or smaller.`);
  }
}

@Injectable()
export class SaveKycDocumentsUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(
    req: Request,
    files: UploadedFileLike[]
  ): Promise<{ success: true }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const byField = new Map<string, UploadedFileLike>();
    for (const file of files) {
      byField.set(file.fieldname, file);
    }

    for (const spec of DOC_SPECS) {
      assertUpload(byField.get(spec.field), spec.displayName);
    }

    const leadForKyc = await this.prisma.client.lead.findFirst({
      where: { customerId: customer.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!leadForKyc) {
      throw new NotFoundException('No active lead found.');
    }
    await assertActiveApplicationLoanDocumentsAccepted(this.prisma.client, {
      leadId: leadForKyc.id,
      customerId: customer.id,
    });
    const applicationForKyc = await this.prisma.client.application.findFirst({
      where: { leadId: leadForKyc.id, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: { kyc: { select: { kycStatus: true } } },
    });
    assertApplicationKycNotCompleted(applicationForKyc?.kyc?.kycStatus);

    const uploadedDocuments = DOC_SPECS.map((spec) => {
      const file = byField.get(spec.field as DocField)!;
      const original = file.originalname?.trim() || `${spec.name}.upload`;
      return original.slice(0, 255);
    });

    await this.prisma.client.$transaction(async (tx) => {
      let customerKyc = await tx.customerKyc.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!customerKyc) {
        customerKyc = await tx.customerKyc.create({
          data: {
            customerId: customer.id,
          },
        });
      }

      await tx.customerKyc.update({
        where: { id: customerKyc.id },
        data: {
          aadhaarData: { uploadedDocuments },
        },
      });
    });

    return { success: true };
  }
}
