import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import {
  formatLeadDetailForPortal,
  isLeadEmailVerifiedForPortal,
} from '../../../../common/mappers/customer-portal-profile.mapper';
import type { CustomerSessionResult } from '../contracts/customer-session-result.contract';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class GetCustomerSessionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsRepository,
  ) {}

  async execute(req: Request): Promise<CustomerSessionResult> {
    const logger = new Logger(GetCustomerSessionUseCase.name);
    const session = req.customerSession;
    if (!session) {
      return { authenticated: false };
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      return { authenticated: false };
    }

    const noLeadResult = {
      authenticated: true as const,
      customerId: customer.uuid,
      mobileNumber: customer.mobileNumber,
      lead: null,
      profile: null,
      journey: {
        detailsCompleted: false,
        loanSelectionCompleted: false,
        kycCompleted: false,
        bankDetailsCompleted: false,
      },
    };

    let leadRow = await this.leads.findActiveByCustomerId(customer.id);
    logger.debug("leadRow", leadRow);

    if (!leadRow) {
      return noLeadResult;
    }

    const statusName = leadRow.leadStatus.name;

    // CONVERTED lead (previous loan fully disbursed) → deactivate so a new journey can start.
    if (statusName === LEAD_STATUS.CONVERTED) {
      await this.leads.deactivate(leadRow.id);
      return noLeadResult;
    }

    // REJECTED or BLACKLISTED → compute rejectedUntil based on the applicable cooldown.
    let rejectedUntil: string | null = null;
    if (statusName === LEAD_STATUS.REJECTED || statusName === LEAD_STATUS.BLACKLISTED) {
      const cooldownDays = statusName === LEAD_STATUS.BLACKLISTED
        ? await this.settings.getBlacklistDurationDays()
        : await this.settings.getReapplyAfterRejectedDays();
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const canReapplyAt = new Date(leadRow.updatedAt.getTime() + cooldownMs);

      if (canReapplyAt.getTime() > Date.now()) {
        rejectedUntil = canReapplyAt.toISOString();
      } else {
        await this.leads.deactivate(leadRow.id);
        return noLeadResult;
      }
    }

    const application = await this.prisma.client.application.findFirst({
      where: { leadId: leadRow.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, emailVerificationType: true },
    });

    const emailVerified = isLeadEmailVerifiedForPortal(
      statusName,
      application?.email ?? null,
      application?.emailVerificationType ?? null,
    );

    let profile = formatLeadDetailForPortal(
      leadRow.leadDetail
        ? {
            ...leadRow.leadDetail,
            panNumber: leadRow.panNumber ?? null,
            panVerified: leadRow.panVerified,
            panVerifiedAt: leadRow.panVerifiedAt,
          }
        : null,
    );

    const [appDetails, disbursement, latestCustomerKyc] = await Promise.all([
      application
        ? this.prisma.client.applicationDetails.findUnique({
            where: { applicationId: application.id },
            select: { loanAmount: true, loanTenure: true },
          })
        : Promise.resolve(null),
      application
        ? this.prisma.client.applicationDisbursement.findUnique({
            where: { applicationId: application.id },
            select: { accountNumber: true, ifscCode: true, bankName: true },
          })
        : Promise.resolve(null),
      this.prisma.client.customerKyc.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, kycVerifiedAt: true, fullName: true },
      }),
    ]);

    const kycDisplayName = latestCustomerKyc?.fullName?.trim();
    if (profile && kycDisplayName && !profile.fullName?.trim()) {
      profile = { ...profile, fullName: kycDisplayName };
    }

    const detailsCompleted = Boolean(
      profile?.fullName?.trim() &&
        profile?.dob?.trim() &&
        profile?.gender &&
        profile?.occupation &&
        profile?.addressLine1?.trim() &&
        profile?.currentCity?.trim() &&
        profile?.pincode?.trim() &&
        profile?.creditConsentAccepted
    );

    const loanSelectionCompleted = Boolean(appDetails?.loanAmount != null && appDetails?.loanTenure != null);

    const kycDocsCount = latestCustomerKyc
      ? await this.prisma.client.customerKycDocument.count({
          where: { customerKycId: latestCustomerKyc.id },
        })
      : 0;
    const kycCompleted = Boolean(
      latestCustomerKyc &&
        (latestCustomerKyc.kycVerifiedAt != null || kycDocsCount >= 3)
    );

    const bankDetailsCompleted = Boolean(
      disbursement?.accountNumber?.trim() && disbursement?.ifscCode?.trim() && disbursement?.bankName?.trim()
    );

    return {
      authenticated: true,
      customerId: customer.uuid,
      mobileNumber: customer.mobileNumber,
      lead: {
        uuid: leadRow.uuid,
        status: statusName,
        email: application?.email ?? null,
        emailVerified,
        rejectedUntil,
      },
      profile,
      journey: {
        detailsCompleted,
        loanSelectionCompleted,
        kycCompleted,
        bankDetailsCompleted,
      },
    };
  }
}
