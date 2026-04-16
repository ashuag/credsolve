"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LosMastersService = void 0;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
const lookups_service_1 = require("../../lookups/lookups.service");
const eligibility_criteria_repository_1 = require("../../application/repositories/eligibility-criteria.repository");
const credit_limit_tier_repository_1 = require("../../application/repositories/credit-limit-tier.repository");
let LosMastersService = class LosMastersService {
    prisma;
    lookupsService;
    eligibilityCriteriaRepository;
    creditLimitTierRepository;
    constructor(prisma, lookupsService, eligibilityCriteriaRepository, creditLimitTierRepository) {
        this.prisma = prisma;
        this.lookupsService = lookupsService;
        this.eligibilityCriteriaRepository = eligibilityCriteriaRepository;
        this.creditLimitTierRepository = creditLimitTierRepository;
    }
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
            leadStatuses: leadStatuses.map((status) => this.serializeLeadStatus(status)),
            applicationStatuses: applicationStatuses.map((status) => this.serializeApplicationStatus(status)),
            leadSources: leadSources.map((source) => this.serializeLeadSource(source)),
            states: states.map((state) => this.serializeState(state)),
            cities: cities.map((city) => this.serializeCity(city)),
            occupations: occupations.map((occupation) => this.serializeNamedRecord(occupation)),
            reasonsForLoan: reasonsForLoan.map((reason) => this.serializeNamedRecord(reason)),
            genders: genders.map((gender) => this.serializeNamedRecord(gender)),
        };
    }
    async updateLeadStatus(id, dto) {
        const current = await this.ensureLeadStatus(id);
        const data = {};
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
    async updateApplicationStatus(id, dto) {
        const current = await this.ensureApplicationStatus(id);
        const data = {};
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
    async createLeadSource(dto) {
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A lead source with this name already exists.');
        }
    }
    async updateLeadSource(id, dto) {
        await this.ensureLeadSource(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = this.normalizeName(dto.name, 50);
        if (dto.type !== undefined)
            data.type = dto.type;
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A lead source with this name already exists.');
        }
    }
    async createState(dto) {
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A state with this name or code already exists.');
        }
    }
    async updateState(id, dto) {
        await this.ensureState(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = this.normalizeName(dto.name, 100);
        if (dto.code !== undefined)
            data.code = this.normalizeStateCode(dto.code);
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A state with this name or code already exists.');
        }
    }
    async createCity(dto) {
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'This city already exists for the selected state.');
        }
    }
    async updateCity(id, dto) {
        await this.ensureCity(id);
        if (dto.stateId !== undefined) {
            await this.ensureStateExists(dto.stateId);
        }
        const data = {};
        if (dto.name !== undefined)
            data.name = this.normalizeName(dto.name, 100);
        if (dto.stateId !== undefined)
            data.state = { connect: { id: dto.stateId } };
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'This city already exists for the selected state.');
        }
    }
    async createOccupation(dto) {
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'An occupation with this name already exists.');
        }
    }
    async updateOccupation(id, dto) {
        await this.ensureOccupation(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = this.normalizeName(dto.name, 50);
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'An occupation with this name already exists.');
        }
    }
    async createGender(dto) {
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A gender with this name already exists.');
        }
    }
    async createReasonForLoan(dto) {
        try {
            const created = await this.prisma.reasonForLoan.create({
                data: {
                    name: this.normalizeName(dto.name, 50),
                    isActive: true,
                },
                select: { id: true, name: true, isActive: true },
            });
            return this.serializeNamedRecord(created);
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A reason for loan with this name already exists.');
        }
    }
    async updateReasonForLoan(id, dto) {
        await this.ensureReasonForLoan(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = this.normalizeName(dto.name, 50);
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A reason for loan with this name already exists.');
        }
    }
    async updateGender(id, dto) {
        await this.ensureGender(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = this.normalizeName(dto.name, 20);
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
        }
        catch (error) {
            this.throwIfUniqueConstraint(error, 'A gender with this name already exists.');
        }
    }
    async ensureLeadStatus(id) {
        const record = await this.prisma.leadStatus.findUnique({
            where: { id },
            select: { id: true, name: true, displayName: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Lead status #${id} not found.`);
        }
        return record;
    }
    async ensureApplicationStatus(id) {
        const record = await this.prisma.applicationStatus.findUnique({
            where: { id },
            select: { id: true, name: true, displayName: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Application status #${id} not found.`);
        }
        return record;
    }
    async ensureLeadSource(id) {
        const record = await this.prisma.leadSource.findUnique({
            where: { id },
            select: { id: true, name: true, type: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Lead source #${id} not found.`);
        }
        return record;
    }
    async ensureState(id) {
        const record = await this.prisma.state.findUnique({
            where: { id },
            select: { id: true, name: true, code: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`State #${id} not found.`);
        }
        return record;
    }
    async ensureStateExists(id) {
        const state = await this.prisma.state.findUnique({
            where: { id },
            select: { id: true, isActive: true },
        });
        if (!state) {
            throw new common_1.NotFoundException(`State #${id} not found.`);
        }
        if (!state.isActive) {
            throw new common_1.BadRequestException('Select an active state.');
        }
        return state;
    }
    async ensureCity(id) {
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
            throw new common_1.NotFoundException(`City #${id} not found.`);
        }
        return record;
    }
    async ensureOccupation(id) {
        const record = await this.prisma.occupation.findUnique({
            where: { id },
            select: { id: true, name: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Occupation #${id} not found.`);
        }
        return record;
    }
    async ensureGender(id) {
        const record = await this.prisma.gender.findUnique({
            where: { id },
            select: { id: true, name: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Gender #${id} not found.`);
        }
        return record;
    }
    async ensureReasonForLoan(id) {
        const record = await this.prisma.reasonForLoan.findUnique({
            where: { id },
            select: { id: true, name: true, isActive: true },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Reason for loan #${id} not found.`);
        }
        return record;
    }
    normalizeName(value, maxLength) {
        const trimmed = value.trim();
        if (trimmed.length < 2) {
            throw new common_1.BadRequestException('Name must be at least 2 characters long.');
        }
        if (trimmed.length > maxLength) {
            throw new common_1.BadRequestException(`Name must be at most ${maxLength} characters long.`);
        }
        return trimmed;
    }
    normalizeStateCode(code) {
        return code.trim().toUpperCase();
    }
    normalizeStatusDisplayName(value, code) {
        const normalized = this.normalizeName(value, 50);
        return normalized.toLowerCase() === code.trim().toLowerCase() ? null : normalized;
    }
    throwIfUniqueConstraint(error, message) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new common_1.ConflictException(message);
        }
        throw error;
    }
    serializeLeadStatus(status) {
        const customDisplayName = status.displayName?.trim() ? status.displayName.trim() : null;
        return {
            id: status.id,
            code: status.name,
            displayName: customDisplayName ?? status.name,
            customDisplayName,
            isActive: status.isActive,
        };
    }
    serializeApplicationStatus(status) {
        const customDisplayName = status.displayName?.trim() ? status.displayName.trim() : null;
        return {
            id: status.id,
            code: status.name,
            displayName: customDisplayName ?? status.name,
            customDisplayName,
            isActive: status.isActive,
        };
    }
    serializeLeadSource(source) {
        return {
            id: source.id,
            name: source.name,
            type: source.type,
            isActive: source.isActive,
        };
    }
    serializeState(state) {
        return {
            id: state.id,
            name: state.name,
            code: state.code,
            isActive: state.isActive,
        };
    }
    serializeCity(city) {
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
    serializeNamedRecord(record) {
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
    async updateEligibilityCriterion(id, dto) {
        const allRows = await this.eligibilityCriteriaRepository.findAll();
        const record = allRows.find(r => r.id === id);
        if (!record)
            throw new common_1.NotFoundException(`Eligibility criterion #${id} not found.`);
        if (dto.value !== undefined && dto.value.trim() === '') {
            throw new common_1.BadRequestException('Value must not be empty.');
        }
        const data = {};
        if (dto.value !== undefined)
            data.value = dto.value.trim();
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
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
    async updateCreditLimitTier(id, dto) {
        const allTiers = await this.creditLimitTierRepository.findAll();
        const record = allTiers.find(r => r.id === id);
        if (!record)
            throw new common_1.NotFoundException(`Credit limit tier #${id} not found.`);
        const data = {};
        if (dto.minUnsecuredLoan !== undefined)
            data.minUnsecuredLoan = dto.minUnsecuredLoan;
        if (dto.maxUnsecuredLoan !== undefined)
            data.maxUnsecuredLoan = dto.maxUnsecuredLoan;
        if (dto.maxBulletLoan !== undefined)
            data.maxBulletLoan = dto.maxBulletLoan;
        if (dto.sortOrder !== undefined)
            data.sortOrder = dto.sortOrder;
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
        if (Object.keys(data).length === 0) {
            return record;
        }
        return this.creditLimitTierRepository.updateById(id, data);
    }
};
exports.LosMastersService = LosMastersService;
exports.LosMastersService = LosMastersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        lookups_service_1.LookupsService,
        eligibility_criteria_repository_1.EligibilityCriteriaRepository,
        credit_limit_tier_repository_1.CreditLimitTierRepository])
], LosMastersService);
