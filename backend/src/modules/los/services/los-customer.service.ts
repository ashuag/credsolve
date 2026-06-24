import { Injectable, NotFoundException } from '@nestjs/common';
import { PAN_VERIFIED } from '../../../common/constants/pan-verification.constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatLosPersonName } from '../format-los-person-name';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

function panVerifiedStatusLabel(code: number): string {
  switch (code) {
    case PAN_VERIFIED.NOT_CHECKED:
      return 'Not checked';
    case PAN_VERIFIED.VERIFIED:
      return 'Verified';
    case PAN_VERIFIED.NOT_VERIFIED:
      return 'Not verified';
    case PAN_VERIFIED.API_FAILURE:
      return 'API failure';
    case PAN_VERIFIED.API_DISABLED:
      return 'Disabled';
    default:
      return `Unknown (${code})`;
  }
}

function applicationKycStatusLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Not done';
    case 1:
      return 'Completed';
    case 2:
      return 'Failed';
    case 3:
      return 'Technical issue';
    default:
      return `Unknown (${code})`;
  }
}

@Injectable()
export class LosCustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers() {
    const customers = await this.prisma.client.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        leads: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            leadStatus: { select: { name: true, displayName: true } },
            leadDetail: { select: { fullName: true } },
          },
        },
        _count: { select: { leads: true, applications: true } },
      },
      take: 500,
    });

    return customers.map((customer) => {
      const latestLead = customer.leads[0] ?? null;
      return {
        uuid: customer.uuid,
        mobileNumber: customer.mobileNumber,
        fullName: formatLosPersonName(latestLead?.leadDetail?.fullName),
        isBlacklisted: customer.isBlacklisted,
        kycVerifiedAt: customer.kycVerifiedAt?.toISOString() ?? null,
        leadCount: customer._count.leads,
        applicationCount: customer._count.applications,
        latestLeadStatusCode: latestLead?.leadStatus.name ?? null,
        latestLeadStatusLabel: latestLead
          ? displayName(latestLead.leadStatus.name, latestLead.leadStatus.displayName)
          : null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      };
    });
  }

  async getCustomerDetails(customerUuid: string) {
    const customer = await this.prisma.client.customer.findUnique({
      where: { uuid: customerUuid },
      include: {
        leads: {
          include: {
            leadStatus: { select: { name: true, displayName: true } },
            rejectionReason: { select: { name: true } },
            source: { select: { name: true, type: true } },
            leadDetail: {
              include: {
                city: { select: { name: true, state: { select: { name: true, code: true } } } },
                gender: { select: { name: true } },
                occupation: { select: { name: true } },
              },
            },
            _count: { select: { applications: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        applications: {
          include: {
            lead: { select: { uuid: true } },
            applicationStatus: { select: { name: true, displayName: true } },
            details: { select: { loanAmount: true, loanTenure: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const profileLead = customer.leads.find((lead) => lead.leadDetail != null);
    const detail = profileLead?.leadDetail ?? null;

    return {
      uuid: customer.uuid,
      mobileNumber: customer.mobileNumber,
      isBlacklisted: customer.isBlacklisted,
      kycVerifiedAt: customer.kycVerifiedAt?.toISOString() ?? null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      profile: detail
        ? {
            fullName: formatLosPersonName(detail.fullName),
            dateOfBirth: detail.dateOfBirth ? detail.dateOfBirth.toISOString().slice(0, 10) : null,
            panNumber: profileLead?.panNumber ?? null,
            pincode: detail.pincode,
            addressLine1: detail.addressLine1,
            addressLine2: detail.addressLine2,
            city: detail.city?.name ?? null,
            state: detail.city?.state?.name ?? null,
            stateCode: detail.city?.state?.code ?? null,
            gender: detail.gender?.name ?? null,
            occupation: detail.occupation?.name ?? null,
            netMonthlyIncome: detail.netMonthlyIncome?.toString() ?? null,
            annualTurnover: detail.annualTurnover?.toString() ?? null,
            annualProfit: detail.annualProfit?.toString() ?? null,
            cibilConsentAt: detail.cibilConsentAt?.toISOString() ?? null,
          }
        : null,
      leads: customer.leads.map((lead) => ({
        uuid: lead.uuid,
        statusCode: lead.leadStatus.name,
        statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
        isActive: lead.isActive,
        rejectionReason: lead.rejectionReason
          ? {
              code: lead.rejectionReason.name,
              label: lead.rejectionReason.name.replace(/_/g, ' '),
            }
          : null,
        leadStatusNote: lead.leadStatusNote?.trim() || null,
        sourceName: lead.source?.name ?? null,
        sourceType: lead.source?.type ?? null,
        panVerified: lead.panVerified,
        panVerifiedLabel: panVerifiedStatusLabel(lead.panVerified),
        bureauFetched: lead.bureauFetched,
        applicationCount: lead._count.applications,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      })),
      applications: customer.applications.map((application) => ({
        uuid: application.uuid,
        leadUuid: application.lead.uuid,
        email: application.email,
        statusCode: application.applicationStatus.name,
        statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
        loanAmount: application.details?.loanAmount?.toString() ?? null,
        loanTenure: application.details?.loanTenure ?? null,
        kycStatus: application.kycStatus,
        kycStatusLabel: applicationKycStatusLabel(application.kycStatus),
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      })),
    };
  }
}
