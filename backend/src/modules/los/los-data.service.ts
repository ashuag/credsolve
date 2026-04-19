import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateBankMasterDto } from './dto/update-bank-master.dto';
import type { UpdateEligibilityCriterionDto } from './dto/update-eligibility-criterion.dto';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

@Injectable()
export class LosDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listLeads() {
    const leads = await this.prisma.client.lead.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        leadStatus: { select: { name: true, displayName: true } },
        source: { select: { name: true, type: true } },
        leadUtms: { select: { utmSource: true, utmMedium: true, utmCampaign: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 500,
    });

    return leads.map((lead) => {
      const latestUtm = lead.leadUtms[0];
      return {
        uuid: lead.uuid,
        customerUuid: lead.customer.uuid,
        mobileNumber: lead.customer.mobileNumber,
        email: lead.email,
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

  async listApplications() {
    const applications = await this.prisma.client.application.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: { select: { uuid: true, email: true, leadDetail: { select: { fullName: true } } } },
        applicationStatus: { select: { name: true, displayName: true } },
        details: { select: { loanAmount: true } },
      },
      take: 500,
    });

    return applications.map((application) => ({
      uuid: application.uuid,
      customerUuid: application.customer.uuid,
      leadUuid: application.lead.uuid,
      mobileNumber: application.customer.mobileNumber,
      email: application.lead.email,
      fullName: application.lead.leadDetail?.fullName ?? null,
      loanAmount: application.details?.loanAmount?.toString() ?? null,
      statusCode: application.applicationStatus.name,
      statusLabel: displayName(application.applicationStatus.name, application.applicationStatus.displayName),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    }));
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

    return {
      uuid: lead.uuid,
      customerUuid: lead.customer.uuid,
      mobileNumber: lead.customer.mobileNumber,
      email: lead.email,
      statusCode: lead.leadStatus.name,
      statusLabel: displayName(lead.leadStatus.name, lead.leadStatus.displayName),
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
            panNumber: detail.panNumber,
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

  async getMasters() {
    const [leadStatuses, applicationStatuses, leadSources, states, cities, occupations, reasonsForLoan, genders, banks] = await Promise.all([
      this.prisma.client.leadStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.client.applicationStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.client.leadSource.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.state.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.city.findMany({ include: { state: true }, orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }] }),
      this.prisma.client.occupation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.reasonForLoan.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.gender.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.bank.findMany({ orderBy: { name: 'asc' } }),
    ]);

    return {
      leadStatuses: leadStatuses.map((item) => ({
        id: item.id,
        code: item.name,
        displayName: displayName(item.name, item.displayName),
        customDisplayName: item.displayName,
        isActive: item.isActive,
      })),
      applicationStatuses: applicationStatuses.map((item) => ({
        id: item.id,
        code: item.name,
        displayName: displayName(item.name, item.displayName),
        customDisplayName: item.displayName,
        isActive: item.isActive,
      })),
      leadSources: leadSources.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        isActive: item.isActive,
      })),
      states: states.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        isActive: item.isActive,
      })),
      cities: cities.map((item) => ({
        id: item.id,
        name: item.name,
        stateId: item.stateId,
        stateName: item.state.name,
        stateCode: item.state.code,
        stateIsActive: item.state.isActive,
        isActive: item.isActive,
      })),
      occupations: occupations.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      reasonsForLoan: reasonsForLoan.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      genders: genders.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      banks: banks.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
    };
  }

  private mapBank(item: { id: number; name: string; isActive: boolean }) {
    return { id: item.id, name: item.name, isActive: item.isActive };
  }

  async createBank(name: string) {
    try {
      const row = await this.prisma.client.bank.create({
        data: { name, isActive: true },
      });
      return this.mapBank(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A bank with this name already exists.');
      }
      throw error;
    }
  }

  async updateBank(id: number, dto: UpdateBankMasterDto) {
    const hasName = dto.name !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasName && !hasActive) {
      throw new BadRequestException('Provide name and/or isActive to update.');
    }

    const existing = await this.prisma.client.bank.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bank not found');
    }

    const data: { name?: string; isActive?: boolean } = {};
    if (hasName) {
      const trimmed = dto.name!.trim();
      if (!trimmed) {
        throw new BadRequestException('Bank name cannot be empty.');
      }
      data.name = trimmed;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.bank.update({
        where: { id },
        data,
      });
      return this.mapBank(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A bank with this name already exists.');
      }
      throw error;
    }
  }

  async deleteBank(id: number) {
    const existing = await this.prisma.client.bank.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Bank not found');
    }

    await this.prisma.client.bank.delete({ where: { id } });
    return { ok: true as const };
  }

  async getEligibilityCriteriaForLos() {
    const rows = await this.prisma.client.eligibilityCriteria.findMany({
      orderBy: { id: 'asc' },
    });

    const eligibilityCriteria = rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      value: row.value,
      description: row.description,
      isActive: row.isActive,
    }));

    return { eligibilityCriteria };
  }

  async updateEligibilityCriterion(id: number, dto: UpdateEligibilityCriterionDto) {
    const hasValue = dto.value !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasValue && !hasActive) {
      throw new BadRequestException('Provide value and/or isActive to update.');
    }

    const existing = await this.prisma.client.eligibilityCriteria.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Eligibility criterion not found');
    }

    const data: { value?: string; isActive?: boolean } = {};
    if (hasValue) {
      const trimmed = dto.value!.trim();
      if (!trimmed) {
        throw new BadRequestException('Value cannot be empty.');
      }
      data.value = trimmed;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    const row = await this.prisma.client.eligibilityCriteria.update({
      where: { id },
      data,
    });

    return {
      id: row.id,
      key: row.key,
      label: row.label,
      value: row.value,
      description: row.description,
      isActive: row.isActive,
    };
  }
}
