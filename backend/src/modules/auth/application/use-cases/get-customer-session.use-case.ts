import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  formatLeadDetailForPortal,
  isLeadEmailVerifiedForPortal,
} from '../../../../common/mappers/customer-portal-profile.mapper';
import type { CustomerSessionResult } from '../contracts/customer-session-result.contract';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class GetCustomerSessionUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(req: Request): Promise<CustomerSessionResult> {
    const session = req.customerSession;
    if (!session) {
      return { authenticated: false };
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      return { authenticated: false };
    }

    const leadRow = await this.leads.findActiveByCustomerId(undefined, customer.id);
    if (!leadRow) {
      return {
        authenticated: true,
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
    }

    const statusName = leadRow.leadStatus.name;
    const emailVerified = isLeadEmailVerifiedForPortal(
      statusName,
      leadRow.email,
      leadRow.emailVerificationType
    );

    const profile = formatLeadDetailForPortal(leadRow.leadDetail);

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

    const application = await this.prisma.client.application.findFirst({
      where: { leadId: leadRow.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

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
        select: { id: true, kycVerifiedAt: true },
      }),
    ]);

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
        email: leadRow.email,
        emailVerified,
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
