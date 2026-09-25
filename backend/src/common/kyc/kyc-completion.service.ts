import { Injectable } from '@nestjs/common';
import { Prisma, type Prisma as PrismaTypes } from '@prisma/client';
import { APPLICATION_KYC_STATUS } from '../constants/application.constants';
import { SettingKey } from '../constants/setting.constants';
import { isDigilockerAadhaarCaptureComplete } from './aadhaar-vendor-parse.util';
import {
  customerAadhaarAppliesToApplication,
  isAadhaarReusedFromPrior,
  isReusableCustomerAadhaar,
  kycValidityCutoff,
  markAadhaarReusedFromPrior,
  parseKycValidityDays,
  pickLatestSuccessfulCustomerAadhaar,
  shouldStartNewCustomerKycBundle,
} from './customer-aadhaar-for-application.util';
import {
  extractActiveLivenessBlock,
  readHeadMovementSnapshot,
} from './kyc-head-movement.util';
import { isKycHeadMovementRequired } from './kyc-liveness-env.util';
import { PrismaService } from '../../prisma/prisma.service';

const REUSABLE_AADHAAR_SELECT = {
  id: true,
  customerId: true,
  aadhaarData: true,
  aadhaarPhotoPath: true,
  aadhaarVerifiedAt: true,
  aadhaarKycType: true,
  panCardNumber: true,
  panCardVerifiedAt: true,
} as const;

type ReusableCustomerAadhaarRow = {
  id: bigint;
  customerId: bigint;
  aadhaarData: Prisma.JsonValue | null;
  aadhaarPhotoPath: string | null;
  aadhaarVerifiedAt: Date | null;
  aadhaarKycType: number | null;
  panCardNumber: string | null;
  panCardVerifiedAt: Date | null;
};

function extractTwelveDigitAadhaar(formJson: unknown): string | null {
  if (formJson == null || typeof formJson !== 'object' || Array.isArray(formJson)) return null;
  for (const value of Object.values(formJson as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 12) return digits;
  }
  return null;
}

@Injectable()
export class KycCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomerKycForApplication(
    tx: PrismaTypes.TransactionClient,
    params: { customerId: bigint; applicationId: bigint },
  ) {
    const application = await tx.application.findUnique({
      where: { id: params.applicationId },
      select: { createdAt: true, kyc: { select: { kycStatus: true } } },
    });
    const latest = await tx.customerKyc.findFirst({
      where: { customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      !shouldStartNewCustomerKycBundle(latest, {
        applicationCreatedAt: application?.createdAt ?? new Date(0),
        applicationKycStatus: application?.kyc?.kycStatus,
      })
    ) {
      return latest;
    }
    return tx.customerKyc.create({
      data: { customerId: params.customerId },
    });
  }

  /**
   * Persists DigiLocker Aadhaar (and optional PAN) on `customer_kyc`.
   * DigiLocker alone must not finish KYC — keeps NOT_DONE unless the face step
   * already passed (selfie + liveness). Re-downloads must not wipe COMPLETED.
   */
  async completeFromDigilockerAadhaar(params: {
    applicationId: bigint;
    customerId: bigint;
    digilockerAadhaarFormJson: PrismaTypes.JsonValue | null;
    aadhaarPhotoRelativePath: string | null;
    verifiedAt: Date;
    /** Optional DigiLocker PAN (Surepass) — stored on `customer_kyc.pan_card_number`. */
    panCardNumber?: string | null;
    aadhaarKycType?: number | null;
  }): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.applicationKyc.findUnique({
        where: { applicationId: params.applicationId },
        select: {
          kycStatus: true,
          kycCompletedAt: true,
          livenessPassed: true,
          livenessSelfiePath: true,
          livenessDoneAt: true,
          livenessCheckedAt: true,
        },
      });
      // `livenessPassed` is only set after the full face pipeline (including head movement).
      const faceStepAlreadyDone =
        existing?.livenessPassed === true && Boolean(existing.livenessSelfiePath?.trim());
      const completedAt =
        existing?.kycCompletedAt ??
        existing?.livenessDoneAt ??
        existing?.livenessCheckedAt ??
        params.verifiedAt;

      await tx.applicationKyc.upsert({
        where: { applicationId: params.applicationId },
        create: {
          applicationId: params.applicationId,
          kycStatus: faceStepAlreadyDone
            ? APPLICATION_KYC_STATUS.COMPLETED
            : APPLICATION_KYC_STATUS.NOT_DONE,
          kycCompletedAt: faceStepAlreadyDone ? completedAt : null,
        },
        update: faceStepAlreadyDone
          ? {
              kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
              kycCompletedAt: completedAt,
            }
          : {
              // Clear stale COMPLETED left by the older DigiLocker-finishes-KYC behaviour.
              kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
              kycCompletedAt: null,
            },
      });

      if (faceStepAlreadyDone) {
        await tx.customer.update({
          where: { id: params.customerId },
          data: { kycVerifiedAt: completedAt },
        });
      }

      const customerKyc = await this.resolveCustomerKycForApplication(tx, {
        applicationId: params.applicationId,
        customerId: params.customerId,
      });

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
          ...(params.aadhaarKycType != null
            ? { aadhaarKycType: params.aadhaarKycType }
            : {}),
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

      const customerKyc = await this.resolveCustomerKycForApplication(tx, {
        applicationId: params.applicationId,
        customerId: params.customerId,
      });

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

  /**
   * Heals applications where DigiLocker + face/liveness already passed but
   * `application_kyc.kyc_status` stayed / was reset to NOT_DONE (Approve blocked,
   * LOS progress still 100%).
   */
  async ensureCompletedWhenFaceStepDone(params: {
    applicationId: bigint;
    customerId: bigint;
  }): Promise<{
    healed: boolean;
    kycStatus: number;
    kycCompletedAt: Date | null;
  }> {
    const application = await this.prisma.client.application.findUnique({
      where: { id: params.applicationId },
      select: {
        createdAt: true,
        kyc: {
          select: {
            kycStatus: true,
            kycCompletedAt: true,
            livenessPassed: true,
            livenessSelfiePath: true,
            livenessDoneAt: true,
            livenessCheckedAt: true,
            livenessVendorJson: true,
          },
        },
      },
    });
    const kyc = application?.kyc;
    if (!kyc) {
      return {
        healed: false,
        kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
        kycCompletedAt: null,
      };
    }
    if (
      kyc.kycStatus === APPLICATION_KYC_STATUS.COMPLETED &&
      kyc.kycCompletedAt
    ) {
      return {
        healed: false,
        kycStatus: kyc.kycStatus,
        kycCompletedAt: kyc.kycCompletedAt,
      };
    }
    if (kyc.kycStatus === APPLICATION_KYC_STATUS.FAILED) {
      return {
        healed: false,
        kycStatus: kyc.kycStatus,
        kycCompletedAt: kyc.kycCompletedAt,
      };
    }

    const ownRows = await this.prisma.client.customerKyc.findMany({
      where: { customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        aadhaarData: true,
        aadhaarPhotoPath: true,
        aadhaarVerifiedAt: true,
      },
    });
    const applying =
      ownRows.find((row) =>
        customerAadhaarAppliesToApplication(row, {
          applicationCreatedAt: application.createdAt,
          applicationKycStatus: kyc.kycStatus,
        }),
      ) ?? pickLatestSuccessfulCustomerAadhaar(ownRows);

    const hasAadhaar = isDigilockerAadhaarCaptureComplete(applying?.aadhaarData);
    const hasSelfie = Boolean(kyc.livenessSelfiePath?.trim());
    const headMovement = readHeadMovementSnapshot(
      extractActiveLivenessBlock(kyc.livenessVendorJson),
    );
    const headMovementSatisfied = !isKycHeadMovementRequired() || headMovement.passed;
    const faceStepDone =
      hasAadhaar && hasSelfie && kyc.livenessPassed === true && headMovementSatisfied;

    if (!faceStepDone || !applying) {
      return {
        healed: false,
        kycStatus: kyc.kycStatus,
        kycCompletedAt: kyc.kycCompletedAt,
      };
    }

    const verifiedAt = kyc.livenessDoneAt ?? kyc.livenessCheckedAt ?? new Date();
    await this.completeAfterFaceLiveness({
      applicationId: params.applicationId,
      customerId: params.customerId,
      digilockerAadhaarFormJson: (applying.aadhaarData ?? null) as Prisma.JsonValue,
      aadhaarPhotoRelativePath: applying.aadhaarPhotoPath,
      selfieRelativePath: kyc.livenessSelfiePath,
      verifiedAt,
    });

    return {
      healed: true,
      kycStatus: APPLICATION_KYC_STATUS.COMPLETED,
      kycCompletedAt: verifiedAt,
    };
  }

  async findLatestSuccessfulCustomerAadhaar(params: {
    customerId: bigint;
    mobileNumber?: string | null;
  }): Promise<ReusableCustomerAadhaarRow | null> {
    const own = await this.prisma.client.customerKyc.findMany({
      where: { customerId: params.customerId, aadhaarVerifiedAt: { not: null } },
      orderBy: [{ aadhaarVerifiedAt: 'desc' }, { id: 'desc' }],
      take: 30,
      select: REUSABLE_AADHAAR_SELECT,
    });
    const fromOwn = pickLatestSuccessfulCustomerAadhaar(own);
    if (fromOwn) return fromOwn;

    const mobile = params.mobileNumber?.trim();
    if (!mobile) return null;
    const byMobile = await this.prisma.client.customerKyc.findMany({
      where: {
        customerId: { not: params.customerId },
        customer: { mobileNumber: mobile },
        aadhaarVerifiedAt: { not: null },
      },
      orderBy: [{ aadhaarVerifiedAt: 'desc' }, { id: 'desc' }],
      take: 30,
      select: REUSABLE_AADHAAR_SELECT,
    });
    return pickLatestSuccessfulCustomerAadhaar(byMobile);
  }

  /**
   * When this application skipped recapture because Aadhaar is still valid,
   * copy that prior KYC onto a customer_kyc row that applies here so LOS shows it.
   */
  async linkReusableAadhaarToApplication(params: {
    applicationId: bigint;
    customerId: bigint;
    mobileNumber?: string | null;
    leadFullName?: string | null;
    leadDateOfBirth?: Date | null;
    leadGender?: string | null;
  }): Promise<{ linked: boolean; complete: boolean; reusedFromPrior: boolean }> {
    const application = await this.prisma.client.application.findUnique({
      where: { id: params.applicationId },
      select: {
        createdAt: true,
        kyc: { select: { kycStatus: true } },
        details: { select: { aadhaarNumber: true } },
      },
    });
    if (!application) {
      return { linked: false, complete: false, reusedFromPrior: false };
    }

    const ownRows = await this.prisma.client.customerKyc.findMany({
      where: { customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: REUSABLE_AADHAAR_SELECT,
    });
    const applying = ownRows.find((row) =>
      customerAadhaarAppliesToApplication(row, {
        applicationCreatedAt: application.createdAt,
        applicationKycStatus: application.kyc?.kycStatus,
      }),
    );
    if (applying && isDigilockerAadhaarCaptureComplete(applying.aadhaarData)) {
      return {
        linked: false,
        complete: true,
        reusedFromPrior: isAadhaarReusedFromPrior(applying.aadhaarData),
      };
    }

    const validityDays = await this.readKycValidityDays();
    const reuseParams = {
      validityDays,
      leadFullName: params.leadFullName,
      leadDateOfBirth: params.leadDateOfBirth,
      leadGender: params.leadGender,
    };
    let prior =
      ownRows.find((row) => isReusableCustomerAadhaar(row, reuseParams)) ??
      (await this.findReusableCustomerAadhaar({
        customerId: params.customerId,
        mobileNumber: params.mobileNumber,
        ...reuseParams,
      }));
    if (!prior || !isReusableCustomerAadhaar(prior, reuseParams)) {
      return { linked: false, complete: false, reusedFromPrior: false };
    }

    const reusablePrior = prior;
    const verifiedAt = new Date();
    const linkedData = markAadhaarReusedFromPrior(reusablePrior.aadhaarData, reusablePrior.aadhaarVerifiedAt);
    const enteredAadhaar = application.details?.aadhaarNumber?.trim() || extractTwelveDigitAadhaar(reusablePrior.aadhaarData);

    await this.prisma.client.$transaction(async (tx) => {
      const customerKyc = await this.resolveCustomerKycForApplication(tx, {
        applicationId: params.applicationId,
        customerId: params.customerId,
      });
      if (customerKyc.id === reusablePrior.id) {
        const copy = await tx.customerKyc.create({
          data: { customerId: params.customerId },
        });
        await tx.customerKyc.update({
          where: { id: copy.id },
          data: {
            aadhaarVerifiedAt: verifiedAt,
            aadhaarData: linkedData as Prisma.InputJsonValue,
            aadhaarPhotoPath: reusablePrior.aadhaarPhotoPath,
            aadhaarKycType: reusablePrior.aadhaarKycType,
            ...(reusablePrior.panCardNumber
              ? {
                  panCardNumber: reusablePrior.panCardNumber,
                  panCardVerifiedAt: reusablePrior.panCardVerifiedAt ?? verifiedAt,
                }
              : {}),
          },
        });
      } else {
        await tx.customerKyc.update({
          where: { id: customerKyc.id },
          data: {
            aadhaarVerifiedAt: verifiedAt,
            aadhaarData: linkedData as Prisma.InputJsonValue,
            aadhaarPhotoPath: reusablePrior.aadhaarPhotoPath,
            aadhaarKycType: reusablePrior.aadhaarKycType,
            ...(reusablePrior.panCardNumber && !customerKyc.panCardNumber
              ? {
                  panCardNumber: reusablePrior.panCardNumber,
                  panCardVerifiedAt: reusablePrior.panCardVerifiedAt ?? verifiedAt,
                }
              : {}),
          },
        });
      }

      if (enteredAadhaar && enteredAadhaar.length === 12) {
        await tx.applicationDetail.upsert({
          where: { applicationId: params.applicationId },
          create: { applicationId: params.applicationId, aadhaarNumber: enteredAadhaar },
          update: application.details?.aadhaarNumber ? {} : { aadhaarNumber: enteredAadhaar },
        });
      }
    });

    return { linked: true, complete: true, reusedFromPrior: true };
  }

  private async readKycValidityDays(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.KYC_VALIDITY_DAYS.key, isActive: true },
      select: { value: true },
    });
    return parseKycValidityDays(row?.value);
  }

  private async findReusableCustomerAadhaar(params: {
    customerId: bigint;
    mobileNumber?: string | null;
    validityDays: number;
    leadFullName?: string | null;
    leadDateOfBirth?: Date | null;
    leadGender?: string | null;
  }): Promise<ReusableCustomerAadhaarRow | null> {
    const cutoff = kycValidityCutoff(new Date(), params.validityDays);
    const own = await this.prisma.client.customerKyc.findMany({
      where: {
        customerId: params.customerId,
        aadhaarVerifiedAt: { gte: cutoff },
      },
      orderBy: [{ aadhaarVerifiedAt: 'desc' }, { id: 'desc' }],
      take: 30,
      select: REUSABLE_AADHAAR_SELECT,
    });
    const fromOwn = own.find((row) => isReusableCustomerAadhaar(row, params));
    if (fromOwn) return fromOwn;

    const mobile = params.mobileNumber?.trim();
    if (!mobile) return null;
    const byMobile = await this.prisma.client.customerKyc.findMany({
      where: {
        customerId: { not: params.customerId },
        customer: { mobileNumber: mobile },
        aadhaarVerifiedAt: { gte: cutoff },
      },
      orderBy: [{ aadhaarVerifiedAt: 'desc' }, { id: 'desc' }],
      take: 30,
      select: REUSABLE_AADHAAR_SELECT,
    });
    return byMobile.find((row) => isReusableCustomerAadhaar(row, params)) ?? null;
  }
}
