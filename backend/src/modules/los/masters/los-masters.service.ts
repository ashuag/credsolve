import { LeadSourceType, Prisma } from '@prisma/client';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LookupsService } from '../../lookups/lookups.service';
import { EligibilityCriteriaRepository } from '../../application/repositories/eligibility-criteria.repository';
import { CreditLimitTierRepository } from '../../application/repositories/credit-limit-tier.repository';
import { CreateCityDto } from './dto/create-city.dto';
import { CreateLeadSourceDto } from './dto/create-lead-source.dto';
import { CreateNamedMasterDto } from './dto/create-named-master.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { UpdateLeadSourceDto } from './dto/update-lead-source.dto';
import { UpdateNamedMasterDto } from './dto/update-named-master.dto';
import { UpdateStateDto } from './dto/update-state.dto';
import { UpdateStatusDisplayNameDto } from './dto/update-status-display-name.dto';

type LeadStatusRecord = {
  id: number;
  name: string;
  displayName: string | null;
  isActive: boolean;
};

type ApplicationStatusRecord = {
  id: number;
  name: string;
  displayName: string | null;
  isActive: boolean;
};

type LeadSourceRecord = {
  id: number;
  name: string;
  type: LeadSourceType;
  isActive: boolean;
};

type StateRecord = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
};

type CityRecord = {
  id: number;
  name: string;
  stateId: number;
  isActive: boolean;
  state: {
    id: number;
    name: string;
    code: string;
    isActive: boolean;
  };
};

type NamedRecord = {
  id: number;
  name: string;
  isActive: boolean;
};

@Injectable()
export class LosMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookupsService: LookupsService,
    private readonly eligibilityCriteriaRepository: EligibilityCriteriaRepository,
    private readonly creditLimitTierRepository: CreditLimitTierRepository,
  ) {}

  async getMasters() {
    const [leadStatuses, applicationStatuses, leadSources, states, cities, occupations, reasonsForLoan, genders] = await Promise.all([
      this.prisma.leadStatus.findMany({
        select: { id: true, name: true, displayName: true, isActive: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.applicationStatus.findMany({
        select: { id: true, name: true, displayName: true, isActive: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.leadSource.findMany({
        select: { id: true, name: true, type: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.state.findMany({
        select: { id: true, name: true, code: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.city.findMany({
        select: {
          id: true,
          name: true,
          stateId: true,
          isActive: true,
          state: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.occupation.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.reasonForLoan.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.gender.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
    ]);

    return {
      leadStatuses: leadStatuses.map((status: LeadStatusRecord) => this.serializeLeadStatus(status)),
      applicationStatuses: applicationStatuses.map((status) => this.serializeApplicationStatus(status)),
      leadSources: leadSources.map((source) => this.serializeLeadSource(source)),
      states: states.map((state) => this.serializeState(state)),
      cities: cities.map((city) => this.serializeCity(city)),
      occupations: occupations.map((occupation) => this.serializeNamedRecord(occupation)),
      reasonsForLoan: reasonsForLoan.map((reason) => this.serializeNamedRecord(reason)),
      genders: genders.map((gender) => this.serializeNamedRecord(gender)),
    };
  }

  async updateLeadStatus(id: number, dto: UpdateStatusDisplayNameDto) {
    const current = await this.ensureLeadStatus(id);

    const data: Prisma.LeadStatusUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = this.normalizeStatusDisplayName(dto.displayName, current.name);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      return this.serializeLeadStatus(current);
    }

    const updated = await this.prisma.leadStatus.update({
      where: { id },
      data,
      select: { id: true, name: true, displayName: true, isActive: true },
    });

    return this.serializeLeadStatus(updated);
  }

  async updateApplicationStatus(id: number, dto: UpdateStatusDisplayNameDto) {
    const current = await this.ensureApplicationStatus(id);

    const data: Prisma.ApplicationStatusUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = this.normalizeStatusDisplayName(dto.displayName, current.name);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      return this.serializeApplicationStatus(current);
    }

    const updated = await this.prisma.applicationStatus.update({
      where: { id },
      data,
      select: { id: true, name: true, displayName: true, isActive: true },
    });

    return this.serializeApplicationStatus(updated);
  }


  async createLeadSource(dto: CreateLeadSourceDto) {
    try {
      const created = await this.prisma.leadSource.create({
        data: {
          name: this.normalizeName(dto.name, 50),
          type: dto.type,
          isActive: true,
        },
        select: { id: true, name: true, type: true, isActive: true },
      });

      return this.serializeLeadSource(created);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A lead source with this name already exists.');
    }
  }

  async updateLeadSource(id: number, dto: UpdateLeadSourceDto) {
    await this.ensureLeadSource(id);

    const data: Prisma.LeadSourceUpdateInput = {};
    if (dto.name !== undefined) data.name = this.normalizeName(dto.name, 50);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return this.serializeLeadSource(await this.ensureLeadSource(id));
    }

    try {
      const updated = await this.prisma.leadSource.update({
        where: { id },
        data,
        select: { id: true, name: true, type: true, isActive: true },
      });

      return this.serializeLeadSource(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A lead source with this name already exists.');
    }
  }

  async createState(dto: CreateStateDto) {
    try {
      const created = await this.prisma.state.create({
        data: {
          name: this.normalizeName(dto.name, 100),
          code: this.normalizeStateCode(dto.code),
          isActive: true,
        },
        select: { id: true, name: true, code: true, isActive: true },
      });

      return this.serializeState(created);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A state with this name or code already exists.');
    }
  }

  async updateState(id: number, dto: UpdateStateDto) {
    await this.ensureState(id);

    const data: Prisma.StateUpdateInput = {};
    if (dto.name !== undefined) data.name = this.normalizeName(dto.name, 100);
    if (dto.code !== undefined) data.code = this.normalizeStateCode(dto.code);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return this.serializeState(await this.ensureState(id));
    }

    try {
      const updated = await this.prisma.state.update({
        where: { id },
        data,
        select: { id: true, name: true, code: true, isActive: true },
      });

      return this.serializeState(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A state with this name or code already exists.');
    }
  }

  async createCity(dto: CreateCityDto) {
    await this.ensureStateExists(dto.stateId);

    try {
      const created = await this.prisma.city.create({
        data: {
          name: this.normalizeName(dto.name, 100),
          stateId: dto.stateId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          stateId: true,
          isActive: true,
          state: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      });

      await this.lookupsService.invalidateCityCache();
      return this.serializeCity(created);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'This city already exists for the selected state.');
    }
  }

  async updateCity(id: number, dto: UpdateCityDto) {
    await this.ensureCity(id);

    if (dto.stateId !== undefined) {
      await this.ensureStateExists(dto.stateId);
    }

    const data: Prisma.CityUpdateInput = {};
    if (dto.name !== undefined) data.name = this.normalizeName(dto.name, 100);
    if (dto.stateId !== undefined) data.state = { connect: { id: dto.stateId } };
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return this.serializeCity(await this.ensureCity(id));
    }

    try {
      const updated = await this.prisma.city.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          stateId: true,
          isActive: true,
          state: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      });

      await this.lookupsService.invalidateCityCache();
      return this.serializeCity(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'This city already exists for the selected state.');
    }
  }

  async createOccupation(dto: CreateNamedMasterDto) {
    try {
      const created = await this.prisma.occupation.create({
        data: {
          name: this.normalizeName(dto.name, 50),
          isActive: true,
        },
        select: { id: true, name: true, isActive: true },
      });

      await this.lookupsService.invalidateOccupationCache();
      return this.serializeNamedRecord(created);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'An occupation with this name already exists.');
    }
  }

  async updateOccupation(id: number, dto: UpdateNamedMasterDto) {
    await this.ensureOccupation(id);

    const data: Prisma.OccupationUpdateInput = {};
    if (dto.name !== undefined) data.name = this.normalizeName(dto.name, 50);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return this.serializeNamedRecord(await this.ensureOccupation(id));
    }

    try {
      const updated = await this.prisma.occupation.update({
        where: { id },
        data,
        select: { id: true, name: true, isActive: true },
      });

      await this.lookupsService.invalidateOccupationCache();
      return this.serializeNamedRecord(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'An occupation with this name already exists.');
    }
  }

  async createGender(dto: CreateNamedMasterDto) {
    try {
      const created = await this.prisma.gender.create({
        data: {
          name: this.normalizeName(dto.name, 20),
          isActive: true,
        },
        select: { id: true, name: true, isActive: true },
      });

      await this.lookupsService.invalidateGenderCache();
      return this.serializeNamedRecord(created);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A gender with this name already exists.');
    }
  }

  async createReasonForLoan(dto: CreateNamedMasterDto) {
    try {
      const created = await this.prisma.reasonForLoan.create({
        data: {
          name: this.normalizeName(dto.name, 50),
          isActive: true,
        },
        select: { id: true, name: true, isActive: true },
      });

      return this.serializeNamedRecord(created);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A reason for loan with this name already exists.');
    }
  }

  async updateReasonForLoan(id: number, dto: UpdateNamedMasterDto) {
    await this.ensureReasonForLoan(id);

    const data: Prisma.ReasonForLoanUpdateInput = {};
    if (dto.name !== undefined) data.name = this.normalizeName(dto.name, 50);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return this.serializeNamedRecord(await this.ensureReasonForLoan(id));
    }

    try {
      const updated = await this.prisma.reasonForLoan.update({
        where: { id },
        data,
        select: { id: true, name: true, isActive: true },
      });

      return this.serializeNamedRecord(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A reason for loan with this name already exists.');
    }
  }

  async updateGender(id: number, dto: UpdateNamedMasterDto) {
    await this.ensureGender(id);

    const data: Prisma.GenderUpdateInput = {};
    if (dto.name !== undefined) data.name = this.normalizeName(dto.name, 20);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return this.serializeNamedRecord(await this.ensureGender(id));
    }

    try {
      const updated = await this.prisma.gender.update({
        where: { id },
        data,
        select: { id: true, name: true, isActive: true },
      });

      await this.lookupsService.invalidateGenderCache();
      return this.serializeNamedRecord(updated);
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'A gender with this name already exists.');
    }
  }

  private async ensureLeadStatus(id: number) {
    const record = await this.prisma.leadStatus.findUnique({
      where: { id },
      select: { id: true, name: true, displayName: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`Lead status #${id} not found.`);
    }

    return record;
  }

  private async ensureApplicationStatus(id: number) {
    const record = await this.prisma.applicationStatus.findUnique({
      where: { id },
      select: { id: true, name: true, displayName: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`Application status #${id} not found.`);
    }

    return record;
  }

  private async ensureLeadSource(id: number) {
    const record = await this.prisma.leadSource.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`Lead source #${id} not found.`);
    }

    return record;
  }

  private async ensureState(id: number) {
    const record = await this.prisma.state.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`State #${id} not found.`);
    }

    return record;
  }

  private async ensureStateExists(id: number) {
    const state = await this.prisma.state.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!state) {
      throw new NotFoundException(`State #${id} not found.`);
    }

    if (!state.isActive) {
      throw new BadRequestException('Select an active state.');
    }

    return state;
  }

  private async ensureCity(id: number) {
    const record = await this.prisma.city.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        stateId: true,
        isActive: true,
        state: {
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`City #${id} not found.`);
    }

    return record;
  }

  private async ensureOccupation(id: number) {
    const record = await this.prisma.occupation.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`Occupation #${id} not found.`);
    }

    return record;
  }

  private async ensureGender(id: number) {
    const record = await this.prisma.gender.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`Gender #${id} not found.`);
    }

    return record;
  }

  private async ensureReasonForLoan(id: number) {
    const record = await this.prisma.reasonForLoan.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!record) {
      throw new NotFoundException(`Reason for loan #${id} not found.`);
    }

    return record;
  }

  private normalizeName(value: string, maxLength: number) {
    const trimmed = value.trim();

    if (trimmed.length < 2) {
      throw new BadRequestException('Name must be at least 2 characters long.');
    }

    if (trimmed.length > maxLength) {
      throw new BadRequestException(`Name must be at most ${maxLength} characters long.`);
    }

    return trimmed;
  }

  private normalizeStateCode(code: string) {
    return code.trim().toUpperCase();
  }

  private normalizeStatusDisplayName(value: string, code: string) {
    const normalized = this.normalizeName(value, 50);
    return normalized.toLowerCase() === code.trim().toLowerCase() ? null : normalized;
  }

  private throwIfUniqueConstraint(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }

    throw error;
  }

  private serializeLeadStatus(status: LeadStatusRecord) {
    const customDisplayName = status.displayName?.trim() ? status.displayName.trim() : null;
    return {
      id: status.id,
      code: status.name,
      displayName: customDisplayName ?? status.name,
      customDisplayName,
      isActive: status.isActive,
    };
  }

  private serializeApplicationStatus(status: ApplicationStatusRecord) {
    const customDisplayName = status.displayName?.trim() ? status.displayName.trim() : null;
    return {
      id: status.id,
      code: status.name,
      displayName: customDisplayName ?? status.name,
      customDisplayName,
      isActive: status.isActive,
    };
  }

  private serializeLeadSource(source: LeadSourceRecord) {
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      isActive: source.isActive,
    };
  }

  private serializeState(state: StateRecord) {
    return {
      id: state.id,
      name: state.name,
      code: state.code,
      isActive: state.isActive,
    };
  }

  private serializeCity(city: CityRecord) {
    return {
      id: city.id,
      name: city.name,
      stateId: city.stateId,
      stateName: city.state.name,
      stateCode: city.state.code,
      stateIsActive: city.state.isActive,
      isActive: city.isActive,
    };
  }

  private serializeNamedRecord(record: NamedRecord) {
    return {
      id: record.id,
      name: record.name,
      isActive: record.isActive,
    };
  }

  // ── Eligibility Criteria ──────────────────────────────────────────────────

  async getEligibilityCriteria() {
    const rows = await this.eligibilityCriteriaRepository.findAll();
    return { eligibilityCriteria: rows };
  }

  async updateEligibilityCriterion(id: number, dto: { value?: string; isActive?: boolean }) {
    const allRows = await this.eligibilityCriteriaRepository.findAll();
    const record = allRows.find(r => r.id === id);
    if (!record) throw new NotFoundException(`Eligibility criterion #${id} not found.`);

    if (dto.value !== undefined && dto.value.trim() === '') {
      throw new BadRequestException('Value must not be empty.');
    }

    const data: { value?: string; isActive?: boolean } = {};
    if (dto.value !== undefined) data.value = dto.value.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return record;
    }

    return this.eligibilityCriteriaRepository.updateById(id, data);
  }

  // ── Credit Limit Tiers ────────────────────────────────────────────────────

  async getCreditLimitTiers() {
    const tiers = await this.creditLimitTierRepository.findAll();
    return { creditLimitTiers: tiers };
  }

  async updateCreditLimitTier(
    id: number,
    dto: { minUnsecuredLoan?: number; maxUnsecuredLoan?: number | null; maxBulletLoan?: number; sortOrder?: number; isActive?: boolean },
  ) {
    const allTiers = await this.creditLimitTierRepository.findAll();
    const record = allTiers.find(r => r.id === id);
    if (!record) throw new NotFoundException(`Credit limit tier #${id} not found.`);

    const data: typeof dto = {};
    if (dto.minUnsecuredLoan !== undefined) data.minUnsecuredLoan = dto.minUnsecuredLoan;
    if (dto.maxUnsecuredLoan !== undefined) data.maxUnsecuredLoan = dto.maxUnsecuredLoan;
    if (dto.maxBulletLoan !== undefined) data.maxBulletLoan = dto.maxBulletLoan;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return record;
    }

    return this.creditLimitTierRepository.updateById(id, data);
  }
}
