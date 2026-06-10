import { Injectable, NotFoundException } from '@nestjs/common';
import { BUREAU_FETCHED } from '../../../common/constants/bureau-fetch.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { PAN_VERIFIED } from '../../../common/constants/pan-verification.constants';
import { PrismaService } from '../../../prisma/prisma.service';

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

function bureauFetchedStatusLabel(code: number): string {
  switch (code) {
    case BUREAU_FETCHED.NOT_FETCHED:
      return 'Not fetched';
    case BUREAU_FETCHED.SUCCESS:
      return 'Fetched';
    case BUREAU_FETCHED.FAILED:
      return 'Failed';
    default:
      return `Unknown (${code})`;
  }
}

@Injectable()
export class LosLeadService {
  constructor(private readonly prisma: PrismaService) {}

  async listLeads() {
    const leads = await this.prisma.client.lead.findMany({
      where: {
        isActive: true,
        // Handed off to Applications — hide from lead queue once converted with an app row.
        NOT: {
          leadStatus: { name: LEAD_STATUS.CONVERTED },
          applications: { some: {} },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        leadStatus: { select: { name: true, displayName: true } },
        rejectionReason: { select: { name: true } },
        source: { select: { name: true, type: true } },
        leadDetail: {
          select: {
            fullName: true,
            occupation: { select: { name: true } },
            city: { select: { name: true, state: { select: { code: true } } } },
          },
        },
        leadUtms: { select: { utmSource: true, utmMedium: true, utmCampaign: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        bureauReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { cibilScore: true },
        },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            email: true,
            eligibility: { select: { cibilScore: true } },
          },
        },
      },
      take: 500,
    });

    return leads.map((lead) => {
      const latestUtm = lead.leadUtms[0];
      const detail = lead.leadDetail;
      const cityName = detail?.city?.name ?? null;
      const stateCode = detail?.city?.state?.code ?? null;
      const city =
        cityName != null ? (stateCode ? `${cityName}, ${stateCode}` : cityName) : null;
      const cibilScore =
        lead.bureauReports[0]?.cibilScore ?? lead.applications[0]?.eligibility?.cibilScore ?? null;

      return {
        uuid: lead.uuid,
        customerUuid: lead.customer.uuid,
        fullName: detail?.fullName?.trim() || null,
        panNumber: lead.panNumber?.trim().toUpperCase() || null,
        mobileNumber: lead.customer.mobileNumber,
        email: lead.applications[0]?.email ?? null,
        occupation: detail?.occupation?.name ?? null,
        city,
        cibilScore,
        panVerified: lead.panVerified,
        panVerifiedLabel: panVerifiedStatusLabel(lead.panVerified),
        rejectionReason: lead.rejectionReason
          ? {
              code: lead.rejectionReason.name,
              label: lead.rejectionReason.name.replace(/_/g, ' '),
            }
          : null,
        leadStatusNote: lead.leadStatusNote?.trim() || null,
        statusCode: lead.leadStatus.name,
        statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
        sourceName: lead.source?.name ?? null,
        sourceType: lead.source?.type ?? null,
        utmSource: latestUtm?.utmSource ?? null,
        utmMedium: latestUtm?.utmMedium ?? null,
        utmCampaign: latestUtm?.utmCampaign ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      };
    });
  }

  async getLeadDetails(leadUuid: string) {
    const lead = await this.prisma.client.lead.findUnique({
      where: { uuid: leadUuid },
      include: {
        customer: { select: { uuid: true, mobileNumber: true, createdAt: true } },
        leadStatus: { select: { name: true, displayName: true } },
        source: { select: { name: true, type: true } },
        leadDetail: {
          include: {
            city: { select: { name: true, state: { select: { name: true, code: true } } } },
            gender: { select: { name: true } },
            occupation: { select: { name: true } },
          },
        },
        leadUtms: { orderBy: { createdAt: 'desc' }, take: 1 },
        rejectionReason: { select: { name: true } },
        applications: {
          include: {
            applicationStatus: { select: { name: true, displayName: true } },
            details: { select: { loanAmount: true, loanTenure: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const latestUtm = lead.leadUtms[0];
    const detail = lead.leadDetail;
    const noteTrimmed = lead.leadStatusNote?.trim() ?? null;
    const bureauNoteTrimmed = lead.bureauFetchedNote?.trim() ?? null;

    return {
      uuid: lead.uuid,
      customerUuid: lead.customer.uuid,
      mobileNumber: lead.customer.mobileNumber,
      email: lead.applications[0]?.email ?? null,
      statusCode: lead.leadStatus.name,
      statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
      panVerified: lead.panVerified,
      panVerifiedLabel: panVerifiedStatusLabel(lead.panVerified),
      bureauFetched: lead.bureauFetched,
      bureauFetchedLabel: bureauFetchedStatusLabel(lead.bureauFetched),
      leadStatusNote: noteTrimmed,
      bureauFetchedNote: bureauNoteTrimmed,
      rejectionReason: lead.rejectionReason
        ? {
            code: lead.rejectionReason.name,
            label: lead.rejectionReason.name.replace(/_/g, ' '),
          }
        : null,
      sourceName: lead.source?.name ?? null,
      sourceType: lead.source?.type ?? null,
      utm: latestUtm
        ? {
            source: latestUtm.utmSource,
            medium: latestUtm.utmMedium,
            campaign: latestUtm.utmCampaign,
            term: latestUtm.utmTerm,
            content: latestUtm.utmContent,
          }
        : null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      profile: detail
        ? {
            fullName: detail.fullName,
            dateOfBirth: detail.dateOfBirth ? detail.dateOfBirth.toISOString().slice(0, 10) : null,
            panNumber: lead.panNumber,
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
      applications: lead.applications.map((application) => ({
        uuid: application.uuid,
        statusCode: application.applicationStatus.name,
        statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
        loanAmount: application.details?.loanAmount?.toString() ?? null,
        loanTenure: application.details?.loanTenure ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
      })),
    };
  }
}
