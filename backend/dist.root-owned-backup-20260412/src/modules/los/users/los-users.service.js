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
exports.LosUsersService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../../../prisma/prisma.service");
const serialize_los_user_1 = require("../utils/serialize-los-user");
const los_user_invitation_service_1 = require("./los-user-invitation.service");
const ROLE_SELECT = {
    id: true,
    name: true,
    hierarchyLevel: true,
    isActive: true,
};
const USER_SELECT = {
    id: true,
    fullName: true,
    email: true,
    roleId: true,
    managerId: true,
    userRole: { select: ROLE_SELECT },
    manager: {
        select: {
            id: true,
            fullName: true,
            email: true,
            roleId: true,
            isActive: true,
            userRole: { select: ROLE_SELECT },
        },
    },
    isActive: true,
    invitationSentAt: true,
    invitationExpiresAt: true,
    registrationCompletedAt: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
};
let LosUsersService = class LosUsersService {
    prisma;
    configService;
    losUserInvitationService;
    constructor(prisma, configService, losUserInvitationService) {
        this.prisma = prisma;
        this.configService = configService;
        this.losUserInvitationService = losUserInvitationService;
    }
    async findAll() {
        const users = await this.prisma.user.findMany({
            select: USER_SELECT,
            orderBy: { createdAt: 'desc' },
        });
        return (0, serialize_los_user_1.serializeLosUsers)(users);
    }
    async create(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing)
            throw new common_1.ConflictException('A user with this email already exists');
        const managerId = await this.resolveManagerAssignment(dto.roleId, dto.managerId);
        const user = await this.prisma.user.create({
            data: {
                fullName: dto.fullName,
                email: dto.email,
                password: null,
                roleId: dto.roleId,
                managerId,
                isActive: false,
                invitationTokenHash: null,
                invitationSentAt: null,
                invitationExpiresAt: null,
                registrationCompletedAt: null,
            },
            select: USER_SELECT,
        });
        return this.issueInvitation(user.id);
    }
    async update(id, dto) {
        const user = await this.findOne(id);
        const nextRoleId = dto.roleId ?? user.roleId;
        const nextManagerInput = dto.managerId !== undefined ? dto.managerId : user.managerId;
        const managerId = await this.resolveManagerAssignment(nextRoleId, nextManagerInput, id);
        const emailChanged = dto.email !== undefined && dto.email !== user.email;
        const data = {};
        if (dto.fullName !== undefined)
            data['fullName'] = dto.fullName;
        if (dto.email !== undefined) {
            data['email'] = dto.email;
            // Changing the email for a pending user invalidates any previously sent link.
            if (!user.registrationCompletedAt && emailChanged) {
                data['invitationTokenHash'] = null;
                data['invitationSentAt'] = null;
                data['invitationExpiresAt'] = null;
            }
        }
        if (dto.roleId !== undefined)
            data['roleId'] = dto.roleId;
        if (dto.managerId !== undefined || nextRoleId !== user.roleId) {
            data['managerId'] = managerId;
        }
        const updatedUser = await this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
        if (!user.registrationCompletedAt && emailChanged) {
            return this.issueInvitation(updatedUser.id);
        }
        return (0, serialize_los_user_1.serializeLosUser)(updatedUser);
    }
    async toggleStatus(id) {
        const user = await this.findOne(id);
        if (!user.registrationCompletedAt) {
            throw new common_1.ConflictException('Pending agents become active only after setting their password.');
        }
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: USER_SELECT,
        });
        return (0, serialize_los_user_1.serializeLosUser)(updatedUser);
    }
    async resendInvitation(id) {
        const user = await this.findOne(id);
        if (user.registrationCompletedAt) {
            throw new common_1.ConflictException('This agent is already active.');
        }
        return this.issueInvitation(user.id);
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
        if (!user)
            throw new common_1.NotFoundException(`User #${id} not found`);
        return user;
    }
    async resolveManagerAssignment(roleId, managerIdInput, currentUserId) {
        const role = await this.prisma.userRole.findUnique({
            where: { id: roleId },
            select: ROLE_SELECT,
        });
        if (!role)
            throw new common_1.NotFoundException(`Role #${roleId} not found`);
        if (role.hierarchyLevel === 1) {
            if (currentUserId === undefined && managerIdInput !== undefined && managerIdInput !== null) {
                throw new common_1.BadRequestException('Top-level roles cannot have an assigned manager.');
            }
            return null;
        }
        const managerId = this.parseUserId(managerIdInput);
        if (!managerId) {
            throw new common_1.BadRequestException(`Select a reporting manager from hierarchy level ${role.hierarchyLevel - 1}.`);
        }
        if (currentUserId !== undefined && managerId === BigInt(currentUserId)) {
            throw new common_1.BadRequestException('An agent cannot report to themselves.');
        }
        const manager = await this.prisma.user.findUnique({
            where: { id: managerId },
            select: {
                id: true,
                password: true,
                isActive: true,
                userRole: { select: ROLE_SELECT },
            },
        });
        if (!manager) {
            throw new common_1.NotFoundException('Selected manager not found.');
        }
        if (!manager.userRole || manager.userRole.hierarchyLevel !== role.hierarchyLevel - 1) {
            throw new common_1.BadRequestException(`Selected manager must belong to hierarchy level ${role.hierarchyLevel - 1}.`);
        }
        if (!manager.userRole.isActive || !manager.isActive || !manager.password) {
            throw new common_1.BadRequestException('Selected manager must be an active registered agent.');
        }
        return managerId;
    }
    hashInvitationToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    parseUserId(value) {
        if (value === undefined || value === null) {
            return null;
        }
        if (typeof value === 'bigint') {
            return value;
        }
        if (!/^\d+$/.test(value)) {
            throw new common_1.BadRequestException('Invalid manager ID.');
        }
        return BigInt(value);
    }
    async issueInvitation(userId) {
        const invitationToken = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        const invitationTokenHash = this.hashInvitationToken(invitationToken);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (this.getInvitationExpiryHours() * 60 * 60 * 1000));
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                isActive: false,
                invitationTokenHash,
                invitationSentAt: now,
                invitationExpiresAt: expiresAt,
            },
            select: USER_SELECT,
        });
        await this.losUserInvitationService.sendInvitation({
            email: user.email,
            fullName: user.fullName,
            roleName: user.userRole?.name ?? null,
            invitationLink: this.buildInvitationLink(invitationToken),
            expiresAt,
        });
        return (0, serialize_los_user_1.serializeLosUser)(user);
    }
    buildInvitationLink(token) {
        const baseUrl = this.configService.get('LOS_FRONTEND_URL')?.trim() || 'http://localhost:3010';
        return `${baseUrl.replace(/\/+$/, '')}/invite/${token}`;
    }
    getInvitationExpiryHours() {
        const rawValue = this.configService.get('LOS_INVITATION_EXPIRY_HOURS')?.trim();
        const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;
        if (Number.isInteger(parsedValue) && parsedValue > 0) {
            return parsedValue;
        }
        return 24;
    }
};
exports.LosUsersService = LosUsersService;
exports.LosUsersService = LosUsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        los_user_invitation_service_1.LosUserInvitationService])
], LosUsersService);
