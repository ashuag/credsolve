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
exports.LosRolesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../prisma/prisma.service");
let LosRolesService = class LosRolesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.userRole.findMany({
            orderBy: [{ hierarchyLevel: 'asc' }, { id: 'asc' }],
        });
    }
    findAllActive() {
        return this.prisma.userRole.findMany({
            where: { isActive: true },
            orderBy: [{ hierarchyLevel: 'asc' }, { id: 'asc' }],
        });
    }
    async create(dto) {
        // MySQL VARCHAR comparisons are case-insensitive by default (utf8mb4 collation)
        const existing = await this.prisma.userRole.findFirst({
            where: { name: dto.name },
        });
        if (existing)
            throw new common_1.ConflictException('A role with this name already exists');
        this.validateHierarchy(dto.name, dto.hierarchyLevel);
        return this.prisma.userRole.create({
            data: {
                name: dto.name,
                hierarchyLevel: dto.hierarchyLevel,
                isActive: true,
            },
        });
    }
    async update(id, dto) {
        const role = await this.findOne(id);
        if (dto.name) {
            const duplicate = await this.prisma.userRole.findFirst({
                where: { name: dto.name, NOT: { id } },
            });
            if (duplicate)
                throw new common_1.ConflictException('A role with this name already exists');
        }
        const nextName = dto.name ?? role.name;
        const nextHierarchyLevel = dto.hierarchyLevel ?? role.hierarchyLevel;
        this.validateHierarchy(nextName, nextHierarchyLevel);
        return this.prisma.userRole.update({ where: { id }, data: dto });
    }
    async toggleStatus(id) {
        const role = await this.findOne(id);
        return this.prisma.userRole.update({ where: { id }, data: { isActive: !role.isActive } });
    }
    async findOne(id) {
        const role = await this.prisma.userRole.findUnique({ where: { id } });
        if (!role)
            throw new common_1.NotFoundException(`Role #${id} not found`);
        return role;
    }
    validateHierarchy(name, hierarchyLevel) {
        const normalizedName = name.trim().toUpperCase();
        if (normalizedName === 'ADMIN' && hierarchyLevel !== 1) {
            throw new common_1.BadRequestException('ADMIN must remain at hierarchy level 1.');
        }
        if (normalizedName !== 'ADMIN' && hierarchyLevel === 1) {
            throw new common_1.BadRequestException('Hierarchy level 1 is reserved for ADMIN.');
        }
    }
};
exports.LosRolesService = LosRolesService;
exports.LosRolesService = LosRolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LosRolesService);
