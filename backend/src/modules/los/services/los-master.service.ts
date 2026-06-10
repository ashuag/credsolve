import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UpdateLeadSourceMasterDto } from '../dto/update-lead-source-master.dto';
import type { UpdateBankMasterDto } from '../dto/update-bank-master.dto';
import type { UpdateEligibilityCriterionDto } from '../dto/update-eligibility-criterion.dto';
import type { UpdateCreditLimitTierDto } from '../dto/update-credit-limit-tier.dto';
import type { UpdateSmsTemplateDto } from '../dto/update-sms-template.dto';

function displayName(name: string, custom: string | null): string {
  return (custom?.trim() || name).trim();
}

function maskBearerToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return '****';
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

type LosSourceUtmRow = {
  id: number;
  leadSourceId: number;
  utmSource: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  isActive: boolean;
  leadSource: { name: string };
};

@Injectable()
export class LosMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async getMasters() {
    const prismaAny = this.prisma.client as any;

    const [
      leadStatuses,
      applicationStatuses,
      leadSources,
      states,
      cities,
      occupations,
      reasonsForLoan,
      genders,
      banks,
      rejectionReasons,
      sourceUtms,
    ] = await Promise.all([
      this.prisma.client.leadStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.client.applicationStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.client.leadSource.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.state.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.city.findMany({ include: { state: true }, orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }] }),
      this.prisma.client.occupation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.reasonForLoan.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.gender.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.bank.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.client.rejectionReason.findMany({ orderBy: { name: 'asc' } }),
      prismaAny.sourceUtm.findMany({
        include: { leadSource: { select: { name: true } } },
        orderBy: [{ leadSource: { name: 'asc' } }, { id: 'asc' }],
      }),
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
      rejectionReasons: rejectionReasons.map((item) => ({
        id: item.id,
        name: item.name,
        isActive: item.isActive,
      })),
      sourceUtms: (sourceUtms as LosSourceUtmRow[]).map((item) => this.mapSourceUtm(item)),
    };
  }

  private mapBank(item: { id: number; name: string; isActive: boolean }) {
    return { id: item.id, name: item.name, isActive: item.isActive };
  }

  private mapLeadSource(item: { id: number; name: string; type: string; isActive: boolean }) {
    return { id: item.id, name: item.name, type: item.type, isActive: item.isActive };
  }

  private mapSourceUtm(item: LosSourceUtmRow) {
    return {
      id: item.id,
      leadSourceId: item.leadSourceId,
      leadSourceName: item.leadSource.name,
      utmSource: item.utmSource,
      utmCampaign: item.utmCampaign,
      utmTerm: item.utmTerm,
      utmMedium: item.utmMedium,
      utmContent: item.utmContent,
      isActive: item.isActive,
    };
  }

  private async assertLeadSourceExists(leadSourceId: number) {
    const row = await this.prisma.client.leadSource.findUnique({
      where: { id: leadSourceId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Lead source not found');
    }
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

  async createLeadSource(input: { name: string; type: LeadSourceType }) {
    try {
      const row = await this.prisma.client.leadSource.create({
        data: { name: input.name, type: input.type, isActive: true },
      });
      return this.mapLeadSource(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A lead source with this name already exists.');
      }
      throw error;
    }
  }

  async updateLeadSource(id: number, dto: UpdateLeadSourceMasterDto) {
    const hasName = dto.name !== undefined;
    const hasType = dto.type !== undefined;
    const hasActive = dto.isActive !== undefined;
    if (!hasName && !hasType && !hasActive) {
      throw new BadRequestException('Provide name, type, and/or isActive to update.');
    }

    const existing = await this.prisma.client.leadSource.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Lead source not found');
    }

    const data: { name?: string; type?: LeadSourceType; isActive?: boolean } = {};
    if (hasName) {
      const trimmed = dto.name!.trim();
      if (!trimmed) {
        throw new BadRequestException('Lead source name cannot be empty.');
      }
      data.name = trimmed;
    }
    if (hasType) {
      data.type = dto.type;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.leadSource.update({
        where: { id },
        data,
      });
      return this.mapLeadSource(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A lead source with this name already exists.');
      }
      throw error;
    }
  }

  async createSourceUtm(dto: {
    leadSourceId: number;
    utmSource?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmMedium?: string;
    utmContent?: string;
  }) {
    await this.assertLeadSourceExists(dto.leadSourceId);
    const client = this.prisma.client as any;
    const row = await client.sourceUtm.create({
      data: {
        leadSourceId: dto.leadSourceId,
        utmSource: dto.utmSource?.trim() ?? null,
        utmCampaign: dto.utmCampaign?.trim() ?? null,
        utmTerm: dto.utmTerm?.trim() ?? null,
        utmMedium: dto.utmMedium?.trim() ?? null,
        utmContent: dto.utmContent?.trim() ?? null,
        isActive: true,
      },
      include: { leadSource: { select: { name: true } } },
    });
    return this.mapSourceUtm(row as LosSourceUtmRow);
  }

  async updateSourceUtm(id: number, dto: {
    utmSource?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmMedium?: string;
    utmContent?: string;
    isActive?: boolean;
  }) {
    const client = this.prisma.client as any;
    const existing = await client.sourceUtm.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Source UTM not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.utmSource !== undefined) data['utmSource'] = dto.utmSource?.trim() || null;
    if (dto.utmCampaign !== undefined) data['utmCampaign'] = dto.utmCampaign?.trim() || null;
    if (dto.utmTerm !== undefined) data['utmTerm'] = dto.utmTerm?.trim() || null;
    if (dto.utmMedium !== undefined) data['utmMedium'] = dto.utmMedium?.trim() || null;
    if (dto.utmContent !== undefined) data['utmContent'] = dto.utmContent?.trim() || null;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields provided to update.');
    }

    const row = await client.sourceUtm.update({
      where: { id },
      data,
      include: { leadSource: { select: { name: true } } },
    });
    return this.mapSourceUtm(row as LosSourceUtmRow);
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
      breType: row.breType,
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
      breType: row.breType,
      description: row.description,
      isActive: row.isActive,
    };
  }

  async getCreditLimitTiersForLos() {
    const rows = await this.prisma.client.creditLimitTier.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const creditLimitTiers = rows.map((row) => ({
      id: row.id,
      minUnsecuredLoan: row.minUnsecuredLoan,
      maxUnsecuredLoan: row.maxUnsecuredLoan,
      maxBulletLoan: row.maxBulletLoan,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    }));

    return { creditLimitTiers };
  }

  async updateCreditLimitTier(id: number, dto: UpdateCreditLimitTierDto) {
    const hasMin = dto.minUnsecuredLoan !== undefined;
    const hasMax = dto.maxUnsecuredLoan !== undefined;
    const hasBullet = dto.maxBulletLoan !== undefined;
    const hasSort = dto.sortOrder !== undefined;
    const hasActive = dto.isActive !== undefined;

    if (!hasMin && !hasMax && !hasBullet && !hasSort && !hasActive) {
      throw new BadRequestException(
        'Provide minUnsecuredLoan, maxUnsecuredLoan, maxBulletLoan, sortOrder, and/or isActive to update.',
      );
    }

    const existing = await this.prisma.client.creditLimitTier.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Credit limit tier not found');
    }

    const nextMin = hasMin ? dto.minUnsecuredLoan! : existing.minUnsecuredLoan;
    const nextMax = hasMax ? dto.maxUnsecuredLoan! : existing.maxUnsecuredLoan;
    const nextBullet = hasBullet ? dto.maxBulletLoan! : existing.maxBulletLoan;
    const nextSort = hasSort ? dto.sortOrder! : existing.sortOrder;

    if (nextMax != null && nextMax < nextMin) {
      throw new BadRequestException('maxUnsecuredLoan cannot be less than minUnsecuredLoan.');
    }

    const row = await this.prisma.client.creditLimitTier.update({
      where: { id },
      data: {
        ...(hasMin ? { minUnsecuredLoan: nextMin } : {}),
        ...(hasMax ? { maxUnsecuredLoan: nextMax } : {}),
        ...(hasBullet ? { maxBulletLoan: nextBullet } : {}),
        ...(hasSort ? { sortOrder: nextSort } : {}),
        ...(hasActive ? { isActive: dto.isActive } : {}),
      },
    });

    return {
      id: row.id,
      minUnsecuredLoan: row.minUnsecuredLoan,
      maxUnsecuredLoan: row.maxUnsecuredLoan,
      maxBulletLoan: row.maxBulletLoan,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  async getSmsTemplatesForLos() {
    const rows = await this.prisma.client.smsTemplate.findMany({
      orderBy: { id: 'asc' },
    });

    const smsTemplates = rows.map((row) => ({
      id: row.id,
      templateId: row.templateId,
      bearerToken: maskBearerToken(row.bearerToken),
      message: row.message,
      product: row.product,
      isActive: row.isActive,
    }));

    return { smsTemplates };
  }

  async updateSmsTemplate(id: number, dto: UpdateSmsTemplateDto) {
    const hasTemplateId = dto.templateId !== undefined;
    const hasBearerToken = dto.bearerToken !== undefined;
    const hasMessage = dto.message !== undefined;
    const hasProduct = dto.product !== undefined;
    const hasActive = dto.isActive !== undefined;

    if (!hasTemplateId && !hasBearerToken && !hasMessage && !hasProduct && !hasActive) {
      throw new BadRequestException('Provide templateId, bearerToken, message, product, and/or isActive to update.');
    }

    const existing = await this.prisma.client.smsTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SMS template not found');
    }

    const data: {
      templateId?: string;
      bearerToken?: string;
      message?: string;
      product?: string;
      isActive?: boolean;
    } = {};

    if (hasTemplateId) {
      const trimmed = dto.templateId!.trim();
      if (!trimmed) {
        throw new BadRequestException('Template ID cannot be empty.');
      }
      data.templateId = trimmed;
    }
    if (hasBearerToken) {
      const trimmed = dto.bearerToken!.trim();
      if (!trimmed) {
        throw new BadRequestException('Bearer token cannot be empty.');
      }
      data.bearerToken = trimmed;
    }
    if (hasMessage) {
      const trimmed = dto.message!.trim();
      if (!trimmed) {
        throw new BadRequestException('Message cannot be empty.');
      }
      data.message = trimmed;
    }
    if (hasProduct) {
      const trimmed = dto.product!.trim();
      if (!trimmed) {
        throw new BadRequestException('Product cannot be empty.');
      }
      data.product = trimmed;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    const row = await this.prisma.client.smsTemplate.update({
      where: { id },
      data,
    });

    return {
      id: row.id,
      templateId: row.templateId,
      bearerToken: maskBearerToken(row.bearerToken),
      message: row.message,
      product: row.product,
      isActive: row.isActive,
    };
  }
}
