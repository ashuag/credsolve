import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma, type EmailVerificationType } from '@prisma/client';
import { APPLICATION_KYC_STATUS, APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { generateApplicationNumber } from '../../../../common/loan/application-number.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

const APPLICATION_NUMBER_CREATE_ATTEMPTS = 8;

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  /**
   * Creates an application with a unique `applicationNumber`.
   * Retries on rare unique collisions of the random suffix.
   */
  async createDraftApplication(
    params: { leadId: bigint; customerId: bigint; applicationStatusId: number },
    tx?: DbClient,
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < APPLICATION_NUMBER_CREATE_ATTEMPTS; attempt += 1) {
      try {
        return await this.db(tx).application.create({
          data: {
            customerId: params.customerId,
            leadId: params.leadId,
            applicationStatusId: params.applicationStatusId,
            applicationNumber: generateApplicationNumber(),
          },
        });
      } catch (err) {
        lastError = err;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError
          && err.code === 'P2002'
        ) {
          const target = err.meta?.target;
          const targets = Array.isArray(target)
            ? target.map(String)
            : [String(target ?? '')];
          if (targets.some((t) => /application_number|applicationNumber/i.test(t))) {
            continue;
          }
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new InternalServerErrorException('Failed to allocate a unique application number.');
  }

  async ensureDraftApplicationForLead(
    params: { leadId: bigint; customerId: bigint },
    tx?: DbClient,
  ) {
    const existing = await this.db(tx).application.findFirst({
      where: { leadId: params.leadId, customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const draftStatus = await this.db(tx).applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.DRAFT, isActive: true },
      select: { id: true },
    });
    if (!draftStatus) {
      throw new InternalServerErrorException('Application status DRAFT is missing. Run database seeds.');
    }
    return this.createDraftApplication(
      {
        customerId: params.customerId,
        leadId: params.leadId,
        applicationStatusId: draftStatus.id,
      },
      tx,
    );
  }

  private async ensureApplicationDetails(applicationId: bigint, tx?: DbClient) {
    return this.db(tx).applicationDetail.upsert({
      where: { applicationId },
      create: { applicationId },
      update: {},
    });
  }

  private async ensureApplicationKyc(applicationId: bigint, tx?: DbClient) {
    return this.db(tx).applicationKyc.upsert({
      where: { applicationId },
      create: { applicationId },
      update: {},
    });
  }

  async updateEmailWithVerification(
    params: {
      leadId: bigint;
      customerId: bigint;
      email: string;
      verificationType: EmailVerificationType;
    },
    tx?: DbClient,
  ) {
    const application = await this.ensureDraftApplicationForLead(
      { leadId: params.leadId, customerId: params.customerId },
      tx,
    );
    const verifiedAt = new Date();
    await this.ensureApplicationDetails(application.id, tx);
    return this.db(tx).applicationDetail.update({
      where: { applicationId: application.id },
      data: {
        emailId: params.email,
        emailVerificationType: params.verificationType,
        emailVerifiedAt: verifiedAt,
      },
    });
  }

  async updateDigilockerAadhaarArtifacts(
    params: {
      applicationId: bigint;
      customerId: bigint;
      digilockerAadhaarFormJson: Prisma.InputJsonValue;
      aadhaarPhotoRelativePath: string | null;
    },
    tx?: DbClient,
  ) {
    let customerKyc = await this.db(tx).customerKyc.findFirst({
      where: { customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (!customerKyc) {
      customerKyc = await this.db(tx).customerKyc.create({
        data: { customerId: params.customerId },
      });
    }
    return this.db(tx).customerKyc.update({
      where: { id: customerKyc.id },
      data: {
        aadhaarData: params.digilockerAadhaarFormJson,
        aadhaarPhotoPath: params.aadhaarPhotoRelativePath,
      },
    });
  }

  async updateSelfiePath(
    params: { applicationId: bigint; selfieRelativePath: string },
    tx?: DbClient,
  ) {
    await this.ensureApplicationKyc(params.applicationId, tx);
    return this.db(tx).applicationKyc.update({
      where: { applicationId: params.applicationId },
      data: {
        livenessSelfiePath: params.selfieRelativePath,
        selfieFaceValidationJson: Prisma.JsonNull,
        selfieFaceValidationPassed: false,
        faceMatchCheckedAt: null,
        livenessPassed: false,
        isLiveness: false,
        livenessDoneAt: null,
        livenessCheckedAt: null,
        livenessVendorJson: Prisma.JsonNull,
        kycStatus: APPLICATION_KYC_STATUS.NOT_DONE,
      },
    });
  }

  async updateSelfieFaceValidation(
    params: {
      applicationId: bigint;
      selfieFaceValidationJson: Prisma.InputJsonValue;
      passed: boolean;
      checkedAt: Date;
    },
    tx?: DbClient,
  ) {
    await this.ensureApplicationKyc(params.applicationId, tx);
    return this.db(tx).applicationKyc.update({
      where: { applicationId: params.applicationId },
      data: {
        selfieFaceValidationJson: params.selfieFaceValidationJson,
        selfieFaceValidationPassed: params.passed,
        faceMatchCheckedAt: params.checkedAt,
      },
    });
  }

  /** Atomically bumps the failed-liveness counter and returns the new total. */
  async incrementLivenessAttempts(applicationId: bigint, tx?: DbClient): Promise<number> {
    await this.ensureApplicationKyc(applicationId, tx);
    const updated = await this.db(tx).applicationKyc.update({
      where: { applicationId },
      data: { livenessAttempts: { increment: 1 } },
      select: { livenessAttempts: true },
    });
    return updated.livenessAttempts;
  }

  /** Reopens the face pipeline when ops granted a retry or attempts remain. */
  async reopenLivenessPipeline(applicationId: bigint, tx?: DbClient) {
    await this.ensureApplicationKyc(applicationId, tx);
    return this.db(tx).applicationKyc.update({
      where: { applicationId },
      data: {
        isLiveness: false,
        livenessDoneAt: null,
        livenessPassed: false,
      },
    });
  }

  async updateLivenessResult(
    params: {
      applicationId: bigint;
      livenessVendorJson: Prisma.InputJsonValue;
      passed: boolean;
      checkedAt: Date;
      done?: boolean;
      doneAt?: Date | null;
    },
    tx?: DbClient,
  ) {
    await this.ensureApplicationKyc(params.applicationId, tx);
    return this.db(tx).applicationKyc.update({
      where: { applicationId: params.applicationId },
      data: {
        livenessVendorJson: params.livenessVendorJson,
        livenessPassed: params.passed,
        livenessCheckedAt: params.checkedAt,
        ...(params.done !== undefined ? { isLiveness: params.done } : {}),
        ...(params.doneAt !== undefined ? { livenessDoneAt: params.doneAt } : {}),
      },
    });
  }

  /** Stores the S3/Spaces object key for the captured active-liveness video. */
  async updateLivenessVideoPath(
    params: { applicationId: bigint; livenessVideoPath: string },
    tx?: DbClient,
  ) {
    await this.ensureApplicationKyc(params.applicationId, tx);
    const data: Prisma.ApplicationKycUpdateInput = {};
    (data as Record<string, unknown>).livenessVideoPath = params.livenessVideoPath;
    return this.db(tx).applicationKyc.update({
      where: { applicationId: params.applicationId },
      data,
    });
  }
}
