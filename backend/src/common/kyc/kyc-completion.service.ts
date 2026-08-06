import { Injectable } from '@nestjs/common';
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KycCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists DigiLocker Aadhaar (and optional PAN) on `customer_kyc`.
   * DigiLocker is one KYC step — always keeps application KYC as NOT_DONE so
   * journey does not advance to bank details until full KYC is completed later.
   */
  async completeFromDigilockerAadhaar(params: {
    applicationId: bigint;
    customerId: bigint;
    digilockerAadhaarFormJson: PrismaTypes.JsonValue | null;
    aadhaarPhotoRelativePath: string | null;
    verifiedAt: Date;
    /** Optional DigiLocker PAN (Surepass) — stored on `customer_kyc.pan_card_number`. */
    panCardNumber?: string | null;
  }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.applicationKyc.upsert({
        where: { applicationId: params.applicationId },
        create: {
          applicationId: params.applicationId,
          kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: null,
        },
        update: {
          // Clear stale COMPLETED left by the older DigiLocker-finishes-KYC behaviour.
          kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: null,
        },
      });

      let customerKyc = await tx.customerKyc.findFirst({
        where: { customerId: params.customerId },
        orderBy: { createdAt: 'desc' },
      });
      if (!customerKyc) {
        customerKyc = await tx.customerKyc.create({
          data: { customerId: params.customerId },
        });
      }

      const pan =
        typeof params.panCardNumber === 'string' && params.panCardNumber.trim()
          ? params.panCardNumber.trim().toUpperCase().slice(0, 10)
          : null;

      await tx.customerKyc.update({
        where: { id: customerKyc.id },
        data: {
          aadhaarVerifiedAt: params.verifiedAt,
          aadhaarData: params.digilockerAadhaarFormJson ?? Prisma.JsonNull,
          aadhaarPhotoPath: params.aadhaarPhotoRelativePath,
          ...(pan
            ? {
                panCardNumber: pan,
                panCardVerifiedAt: params.verifiedAt,
              }
            : {}),
        },
      });
    });
  }

  /**
   * Marks application KYC complete after selfie + liveness (and DigiLocker Aadhaar) succeed.
   */
  async completeAfterFaceLiveness(params: {
    applicationId: bigint;
    customerId: bigint;
    digilockerAadhaarFormJson: PrismaTypes.JsonValue | null;
    aadhaarPhotoRelativePath: string | null;
    selfieRelativePath?: string | null;
    verifiedAt: Date;
  }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
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

      await tx.customer.update({
        where: { id: params.customerId },
        data: { kycVerifiedAt: params.verifiedAt },
      });

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
