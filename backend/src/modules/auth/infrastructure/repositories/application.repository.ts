import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma, type EmailVerificationType } from '@prisma/client';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from './db.client';

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: DbClient) {
    return tx ?? this.prisma.client;
  }

  /**
   * Returns the latest application for the lead, or creates a DRAFT row so
   * email can be stored before loan selection runs.
   */
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
    return this.db(tx).application.create({
      data: {
        customerId: params.customerId,
        leadId: params.leadId,
        applicationStatusId: draftStatus.id,
      },
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
    return this.db(tx).application.update({
      where: { id: application.id },
      data: {
        email: params.email,
        emailVerificationType: params.verificationType,
        emailVerifiedAt: verifiedAt,
      },
    });
  }

  async updateDigilockerAadhaarArtifacts(
    params: {
      applicationId: bigint;
      digilockerAadhaarFormJson: Prisma.InputJsonValue;
      aadhaarPhotoRelativePath: string | null;
    },
    tx?: DbClient,
  ) {
    return this.db(tx).application.update({
      where: { id: params.applicationId },
      data: {
        digilockerAadhaarFormJson: params.digilockerAadhaarFormJson,
        aadhaarPhotoRelativePath: params.aadhaarPhotoRelativePath,
      },
    });
  }

  async updateSelfiePath(
    params: { applicationId: bigint; selfieRelativePath: string },
    tx?: DbClient,
  ) {
    return this.db(tx).application.update({
      where: { id: params.applicationId },
      data: {
        selfieRelativePath: params.selfieRelativePath,
        livenessPassed: false,
        livenessDone: false,
        livenessDoneAt: null,
        livenessCheckedAt: null,
        livenessVendorJson: Prisma.JsonNull,
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
    return this.db(tx).application.update({
      where: { id: params.applicationId },
      data: {
        livenessVendorJson: params.livenessVendorJson,
        livenessPassed: params.passed,
        livenessCheckedAt: params.checkedAt,
        ...(params.done !== undefined ? { livenessDone: params.done } : {}),
        ...(params.doneAt !== undefined ? { livenessDoneAt: params.doneAt } : {}),
      },
    });
  }
}
