import { Injectable } from '@nestjs/common';
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KycCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Marks application KYC complete and upserts verified customer KYC from DigiLocker Aadhaar. */
  async completeFromDigilockerAadhaar(params: {
    applicationId: bigint;
    customerId: bigint;
    digilockerAadhaarFormJson: PrismaTypes.JsonValue | null;
    aadhaarPhotoRelativePath: string | null;
    verifiedAt: Date;
  }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const appKyc = await tx.applicationKyc.findUnique({
        where: { applicationId: params.applicationId },
        select: { kycStatus: true },
      });

      if (appKyc?.kycStatus !== APPLICATION_KYC_STATUS.COMPLETED) {
        await tx.applicationKyc.upsert({
          where: { applicationId: params.applicationId },
          create: {
            applicationId: params.applicationId,
            kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
            kycCompletedAt: params.verifiedAt,
          },
          update: {
            kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
            kycCompletedAt: params.verifiedAt,
          },
        });
      } else {
        await tx.applicationKyc.update({
          where: { applicationId: params.applicationId },
          data: { kycCompletedAt: params.verifiedAt },
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
          aadhaarVerifiedAt: params.verifiedAt,
          aadhaarData: params.digilockerAadhaarFormJson ?? Prisma.JsonNull,
          aadhaarPhotoPath: params.aadhaarPhotoRelativePath,
        },
      });
    });
  }
}
