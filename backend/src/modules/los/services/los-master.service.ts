import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { isoDateOnlyUtc, parseIsoDateUtc } from '../../../common/loan/repayment-due-date.util';
import { ELIGIBILITY_CRITERIA } from '../../../common/constants/eligibility-criteria.constants';
import { SettingKey } from '../../../common/constants/setting.constants';
import type { UpdateLeadSourceMasterDto } from '../dto/update-lead-source-master.dto';
import type { UpdateBankMasterDto } from '../dto/update-bank-master.dto';
import type { UpdateNamedMasterDto } from '../dto/update-named-master.dto';
import type { UpdateStateMasterDto } from '../dto/update-state-master.dto';
import type { UpdateCityMasterDto } from '../dto/update-city-master.dto';
import type { UpdateRepaymentDueDateDto } from '../dto/update-repayment-due-date.dto';
import type { UpdateEligibilityCriterionDto } from '../dto/update-eligibility-criterion.dto';
import type { UpdateCreditLimitTierDto } from '../dto/update-credit-limit-tier.dto';
import type { UpdateSmsTemplateDto } from '../dto/update-sms-template.dto';
import type { UpdateSettingDto } from '../dto/update-setting.dto';

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

function isPrismaUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function slugMasterKey(name: string, maxLen: number): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
  return slug || 'ITEM';
}

const CREDIT_ASSESSMENT_GRADES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const CREDIT_ASSESSMENT_GRADE_SET = new Set<string>(CREDIT_ASSESSMENT_GRADES);

function normalizeRejectedCreditAssessmentGrades(value: string): string {
  const seen = new Set<string>();
  const invalid: string[] = [];
  for (const part of value.split(',')) {
    const grade = part.trim().toUpperCase();
    if (!grade) continue;
    if (!CREDIT_ASSESSMENT_GRADE_SET.has(grade)) {
      invalid.push(part.trim());
      continue;
    }
    seen.add(grade);
  }
  if (invalid.length) {
    throw new BadRequestException(`Invalid credit-assessment grade(s): ${invalid.join(', ')}. Use A–H.`);
  }
  if (!seen.size) {
    throw new BadRequestException('Select at least one credit-assessment grade.');
  }
  return CREDIT_ASSESSMENT_GRADES.filter((grade) => seen.has(grade)).join(',');
}

function normalizeRejectedLoanTypeIds(value: string): string {
  const seen = new Set<string>();
  const invalid: string[] = [];
  const ids: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (!/^\d{1,2}$/.test(trimmed)) {
      invalid.push(trimmed);
      continue;
    }
    const symbol = trimmed.padStart(2, '0');
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    ids.push(symbol);
  }
  if (invalid.length) {
    throw new BadRequestException(
      `Invalid CIBIL loan type id(s): ${invalid.join(', ')}. Use numeric TUEF account type codes (e.g. 05, 10, 69).`,
    );
  }
  if (!ids.length) {
    throw new BadRequestException('Select at least one loan type, or deactivate the rule instead.');
  }
  return ids.join(',');
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
    const prismaAny = this.prisma.read as any;

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
      repaymentDueDates,
    ] = await Promise.all([
      this.prisma.read.leadStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.read.applicationStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.read.leadSource.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.read.state.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.read.city.findMany({ include: { state: true }, orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }] }),
      this.prisma.read.occupation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.read.reasonForLoan.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.read.gender.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.read.bank.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.read.rejectionReason.findMany({ orderBy: { name: 'asc' } }),
      prismaAny.sourceUtm.findMany({
        include: { leadSource: { select: { name: true } } },
        orderBy: [{ leadSource: { name: 'asc' } }, { id: 'asc' }],
      }),
      this.prisma.read.repaymentDueDate.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
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
      repaymentDueDates: repaymentDueDates.map((item) => this.mapRepaymentDueDate(item)),
    };
  }

  private mapBank(item: { id: number; name: string; isActive: boolean }) {
    return { id: item.id, name: item.name, isActive: item.isActive };
  }

  private mapNamed(item: { id: number; name: string; isActive: boolean }) {
    return { id: item.id, name: item.name, isActive: item.isActive };
  }

  private mapState(item: { id: number; name: string; code: string; isActive: boolean }) {
    return { id: item.id, name: item.name, code: item.code, isActive: item.isActive };
  }

  private mapCity(item: {
    id: number;
    name: string;
    stateId: number;
    isActive: boolean;
    state: { name: string; code: string; isActive: boolean };
  }) {
    return {
      id: item.id,
      name: item.name,
      stateId: item.stateId,
      stateName: item.state.name,
      stateCode: item.state.code,
      stateIsActive: item.state.isActive,
      isActive: item.isActive,
    };
  }

  private mapRepaymentDueDate(item: {
    id: number;
    year: number;
    month: number;
    dueDate: Date;
    isActive: boolean;
  }) {
    return {
      id: item.id,
      year: item.year,
      month: item.month,
      dueDate: isoDateOnlyUtc(item.dueDate),
      isActive: item.isActive,
    };
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

  private async uniqueKeyedMasterKey(
    name: string,
    maxLen: number,
    exists: (key: string) => Promise<boolean>,
    label: string,
  ): Promise<string> {
    const base = slugMasterKey(name, maxLen);
    if (!(await exists(base))) {
      return base;
    }
    for (let i = 2; i < 100; i++) {
      const suffix = `_${i}`;
      const key = `${base.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
      if (!(await exists(key))) {
        return key;
      }
    }
    throw new ConflictException(`Could not generate a unique ${label} key.`);
  }

  private requireNameOrActive(dto: UpdateNamedMasterDto, label: string) {
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new BadRequestException(`Provide name and/or isActive to update ${label}.`);
    }
  }

  private trimMasterName(name: string, label: string, maxLen: number): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException(`${label} cannot be empty.`);
    }
    if (trimmed.length > maxLen) {
      throw new BadRequestException(`${label} cannot exceed ${maxLen} characters.`);
    }
    return trimmed;
  }

  async createOccupation(name: string) {
    const trimmed = this.trimMasterName(name, 'Occupation name', 50);
    const key = await this.uniqueKeyedMasterKey(
      trimmed,
      50,
      async (candidate) =>
        Boolean(await this.prisma.client.occupation.findUnique({ where: { key: candidate }, select: { id: true } })),
      'occupation',
    );

    try {
      const row = await this.prisma.client.occupation.create({
        data: { key, name: trimmed, isActive: true },
      });
      return this.mapNamed(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('An occupation with this name already exists.');
      }
      throw error;
    }
  }

  async updateOccupation(id: number, dto: UpdateNamedMasterDto) {
    this.requireNameOrActive(dto, 'occupation');

    const existing = await this.prisma.client.occupation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Occupation not found');
    }

    const data: { name?: string; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = this.trimMasterName(dto.name, 'Occupation name', 50);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.occupation.update({
        where: { id },
        data,
      });
      return this.mapNamed(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('An occupation with this name already exists.');
      }
      throw error;
    }
  }

  async createGender(name: string) {
    const trimmed = this.trimMasterName(name, 'Gender name', 20);
    const key = await this.uniqueKeyedMasterKey(
      trimmed,
      20,
      async (candidate) =>
        Boolean(await this.prisma.client.gender.findUnique({ where: { key: candidate }, select: { id: true } })),
      'gender',
    );

    try {
      const row = await this.prisma.client.gender.create({
        data: { key, name: trimmed, isActive: true },
      });
      return this.mapNamed(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A gender with this name already exists.');
      }
      throw error;
    }
  }

  async updateGender(id: number, dto: UpdateNamedMasterDto) {
    this.requireNameOrActive(dto, 'gender');

    const existing = await this.prisma.client.gender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Gender not found');
    }

    const data: { name?: string; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = this.trimMasterName(dto.name, 'Gender name', 20);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.gender.update({
        where: { id },
        data,
      });
      return this.mapNamed(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A gender with this name already exists.');
      }
      throw error;
    }
  }

  async createReasonForLoan(name: string) {
    const trimmed = this.trimMasterName(name, 'Reason for loan', 50);

    try {
      const row = await this.prisma.client.reasonForLoan.create({
        data: { name: trimmed, isActive: true },
      });
      return this.mapNamed(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A reason for loan with this name already exists.');
      }
      throw error;
    }
  }

  async updateReasonForLoan(id: number, dto: UpdateNamedMasterDto) {
    this.requireNameOrActive(dto, 'reason for loan');

    const existing = await this.prisma.client.reasonForLoan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Reason for loan not found');
    }

    const data: { name?: string; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = this.trimMasterName(dto.name, 'Reason for loan', 50);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.reasonForLoan.update({
        where: { id },
        data,
      });
      return this.mapNamed(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A reason for loan with this name already exists.');
      }
      throw error;
    }
  }

  async createState(input: { name: string; code: string }) {
    const name = this.trimMasterName(input.name, 'State name', 100);
    const code = this.trimMasterName(input.code, 'State code', 5).toUpperCase();

    try {
      const row = await this.prisma.client.state.create({
        data: { name, code, isActive: true },
      });
      return this.mapState(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A state with this name or code already exists.');
      }
      throw error;
    }
  }

  async updateState(id: number, dto: UpdateStateMasterDto) {
    if (dto.name === undefined && dto.code === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Provide name, code, and/or isActive to update.');
    }

    const existing = await this.prisma.client.state.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('State not found');
    }

    const data: { name?: string; code?: string; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = this.trimMasterName(dto.name, 'State name', 100);
    }
    if (dto.code !== undefined) {
      data.code = this.trimMasterName(dto.code, 'State code', 5).toUpperCase();
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.state.update({
        where: { id },
        data,
      });
      return this.mapState(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A state with this name or code already exists.');
      }
      throw error;
    }
  }

  private async assertStateExists(stateId: number) {
    const row = await this.prisma.client.state.findUnique({
      where: { id: stateId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('State not found');
    }
  }

  private cityInclude() {
    return { state: true } as const;
  }

  async createCity(input: { name: string; stateId: number }) {
    const name = this.trimMasterName(input.name, 'City name', 100);
    await this.assertStateExists(input.stateId);

    try {
      const row = await this.prisma.client.city.create({
        data: { name, stateId: input.stateId, isActive: true },
        include: this.cityInclude(),
      });
      return this.mapCity(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A city with this name already exists in that state.');
      }
      throw error;
    }
  }

  async updateCity(id: number, dto: UpdateCityMasterDto) {
    if (dto.name === undefined && dto.stateId === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Provide name, stateId, and/or isActive to update.');
    }

    const existing = await this.prisma.client.city.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('City not found');
    }

    if (dto.stateId !== undefined) {
      await this.assertStateExists(dto.stateId);
    }

    const data: { name?: string; stateId?: number; isActive?: boolean } = {};
    if (dto.name !== undefined) {
      data.name = this.trimMasterName(dto.name, 'City name', 100);
    }
    if (dto.stateId !== undefined) {
      data.stateId = dto.stateId;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const row = await this.prisma.client.city.update({
        where: { id },
        data,
        include: this.cityInclude(),
      });
      return this.mapCity(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A city with this name already exists in that state.');
      }
      throw error;
    }
  }

  private parseDueDateForMonth(raw: string, year: number, month: number): Date {
    const parsed = parseIsoDateUtc(raw);
    if (!parsed) {
      throw new BadRequestException('Due date must be a valid calendar date (YYYY-MM-DD).');
    }
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    if (parsed.getTime() < monthStart.getTime()) {
      throw new BadRequestException('Due date cannot be before the selected month.');
    }
    return parsed;
  }

  async createRepaymentDueDate(input: { year: number; month: number; dueDate: string }) {
    const dueDate = this.parseDueDateForMonth(input.dueDate, input.year, input.month);
    try {
      const row = await this.prisma.client.repaymentDueDate.create({
        data: { year: input.year, month: input.month, dueDate, isActive: true },
      });
      return this.mapRepaymentDueDate(row);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new ConflictException('A due date for this month already exists.');
      }
      throw error;
    }
  }

  async updateRepaymentDueDate(id: number, dto: UpdateRepaymentDueDateDto) {
    if (dto.dueDate === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Provide dueDate and/or isActive to update.');
    }

    const existing = await this.prisma.client.repaymentDueDate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Due date override not found');
    }

    const data: { dueDate?: Date; isActive?: boolean } = {};
    if (dto.dueDate !== undefined) {
      data.dueDate = this.parseDueDateForMonth(dto.dueDate, existing.year, existing.month);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const row = await this.prisma.client.repaymentDueDate.update({
      where: { id },
      data,
    });
    return this.mapRepaymentDueDate(row);
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
    const rows = await this.prisma.read.eligibilityCriteria.findMany({
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
      const isGradeList =
        existing.key === ELIGIBILITY_CRITERIA.REJECTED_CREDIT_ASSESSMENT_GRADES_NEW ||
        existing.key === ELIGIBILITY_CRITERIA.REJECTED_CREDIT_ASSESSMENT_GRADES_EXISTING;
      const isLoanTypeList =
        existing.key === ELIGIBILITY_CRITERIA.REJECT_OPEN_LOAN_TYPES ||
        existing.key === ELIGIBILITY_CRITERIA.REJECT_LOAN_TYPES;
      data.value = isGradeList
        ? normalizeRejectedCreditAssessmentGrades(trimmed)
        : isLoanTypeList
          ? normalizeRejectedLoanTypeIds(trimmed)
          : trimmed;
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
    const rows = await this.prisma.read.creditLimitTier.findMany({
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
    const rows = await this.prisma.read.smsTemplate.findMany({
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

  async getSettingsForLos() {
    const rows = await this.prisma.read.setting.findMany({
      orderBy: { key: 'asc' },
    });

    const settings = rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      description: row.description,
      isActive: row.isActive,
    }));

    return { settings };
  }

  async updateSetting(id: number, dto: UpdateSettingDto) {
    const hasValue = dto.value !== undefined;
    const hasDescription = dto.description !== undefined;
    const hasActive = dto.isActive !== undefined;

    if (!hasValue && !hasDescription && !hasActive) {
      throw new BadRequestException('Provide value, description, and/or isActive to update.');
    }

    const existing = await this.prisma.client.setting.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Setting not found');
    }

    const data: { value?: string; description?: string | null; isActive?: boolean } = {};

    if (hasValue) {
      const trimmed = dto.value!.trim();
      if (!trimmed) {
        throw new BadRequestException('Value cannot be empty.');
      }
      if (existing.key === SettingKey.PENNY_DROP_NAME_MATCH_MIN_SCORE.key) {
        const n = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(n) || n < 0 || n > 100 || String(n) !== trimmed) {
          throw new BadRequestException(
            'Bank name max fuzzing score must be a whole number from 0 to 100.',
          );
        }
      }
      if (existing.key === SettingKey.BUREAU_FETCH_DAYS_LIMIT.key) {
        const n = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(n) || n < 0 || n > 365 || String(n) !== trimmed) {
          throw new BadRequestException(
            'Bureau fetch days limit must be a whole number from 0 to 365 (0 = always fetch).',
          );
        }
      }
      data.value = trimmed;
    }
    if (hasDescription) {
      const trimmed = dto.description!.trim();
      data.description = trimmed || null;
    }
    if (hasActive) {
      data.isActive = dto.isActive;
    }

    const row = await this.prisma.client.setting.update({
      where: { id },
      data,
    });

    return {
      id: row.id,
      key: row.key,
      value: row.value,
      description: row.description,
      isActive: row.isActive,
    };
  }
}
