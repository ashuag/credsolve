import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { extractProfileFromDigilockerFormJson } from './digilocker-form-profile.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KycCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Marks application KYC complete and upserts verified customer KYC from DigiLocker Aadhaar. */
  async completeFromDigilockerAadhaar(params: {
    applicationId: bigint;
    customerId: bigint;
    digilockerAadhaarFormJson: Prisma.JsonValue | null;
    aadhaarPhotoRelativePath: string | null;
    selfieRelativePath?: string | null;
    verifiedAt: Date;
  }): Promise<void> {
    const profile = extractProfileFromDigilockerFormJson(params.digilockerAadhaarFormJson);

    await this.prisma.client.$transaction(async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: params.applicationId },
        select: { kycStatus: true },
      });
      if (!app) {
        return;
      }

      if (app.kycStatus !== APPLICATION_KYC_STATUS.COMPLETED) {
        await tx.application.update({
          where: { id: params.applicationId },
          data: {
            kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
            kycCompletedAt: params.verifiedAt,
          },
        });
      }

      let customerKyc = await tx.customerKyc.findFirst({
        where: { customerId: params.customerId },
        orderBy: { createdAt: 'desc' },
      });
      if (!customerKyc) {
        customerKyc = await tx.customerKyc.create({
          data: { customerId: params.customerId },
        });
      }

      await tx.customerKyc.update({
        where: { id: customerKyc.id },
        data: {
          kycVerifiedAt: params.verifiedAt,
          ...(profile.fullName ? { fullName: profile.fullName.slice(0, 100) } : {}),
          ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
        },
      });

      const digilockerProvider = await tx.kycProvider.upsert({
        where: { name: 'DIGILOCKER' },
        create: { name: 'DIGILOCKER', displayName: 'DigiLocker', isActive: true },
        update: { displayName: 'DigiLocker', isActive: true },
      });

      const aadhaarFrontType = await tx.kycDocument.upsert({
        where: { name: 'AADHAAR_FRONT' },
        create: { name: 'AADHAAR_FRONT', displayName: 'Aadhaar (front)', isActive: true },
        update: { displayName: 'Aadhaar (front)', isActive: true },
      });

      await tx.customerKycDocument.deleteMany({
        where: {
          customerKycId: customerKyc.id,
          documentTypeId: aadhaarFrontType.id,
          kycProviderId: digilockerProvider.id,
        },
      });

      const auditName = [params.aadhaarPhotoRelativePath, params.selfieRelativePath?.trim()]
        .filter(Boolean)
        .join('|')
        .slice(0, 255);

      await tx.customerKycDocument.create({
        data: {
          customerKycId: customerKyc.id,
          documentTypeId: aadhaarFrontType.id,
          kycProviderId: digilockerProvider.id,
          fileName: auditName.length > 0 ? auditName : 'digilocker-aadhaar',
          verifiedAt: params.verifiedAt,
        },
      });
    });
  }
}
