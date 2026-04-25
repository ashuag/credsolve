import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';
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
    body: Record<string, unknown>,
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

      const uploadProvider = await tx.kycProvider.upsert({
        where: { name: 'UPLOAD' },
        create: { name: 'UPLOAD', displayName: 'Upload Documents', isActive: true },
        update: { displayName: 'Upload Documents', isActive: true },
      });

      const allDocTypes = [
        ...DOC_SPECS,
        { field: 'legacyPanFront', name: 'PAN_FRONT', displayName: 'PAN front' },
        { field: 'legacyPanBack', name: 'PAN_BACK', displayName: 'PAN back' },
        { field: 'legacyAadhaar', name: 'AADHAAR', displayName: 'Aadhaar' },
      ] as const;

      const docTypes = await Promise.all(
        allDocTypes.map((docType) =>
          tx.kycDocument.upsert({
            where: { name: docType.name },
            create: {
              name: docType.name,
              displayName: docType.displayName,
              isActive: true,
            },
            update: {
              displayName: docType.displayName,
              isActive: true,
            },
          })
        )
      );

      const docTypeIds = docTypes.map((d) => d.id);

      await tx.customerKycDocument.deleteMany({
        where: {
          customerKycId: customerKyc.id,
          documentTypeId: { in: docTypeIds },
        },
      });

      const docTypeByName = new Map(docTypes.map((d) => [d.name, d.id]));

      await tx.customerKycDocument.createMany({
        data: DOC_SPECS.map((spec) => {
          const file = byField.get(spec.field as DocField)!;
          const original = file.originalname?.trim() || `${spec.name}.upload`;
          const fileName = original.slice(0, 255);

          return {
            customerKycId: customerKyc.id,
            documentTypeId: docTypeByName.get(spec.name)!,
            kycProviderId: uploadProvider.id,
            fileName,
            verifiedAt: null,
          };
        }),
      });

      const lead = await tx.lead.findFirst({
        where: { customerId: customer.id, isActive: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!lead) {
        throw new NotFoundException('No active lead found.');
      }
    });

    return { success: true };
  }
}
