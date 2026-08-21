import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLosRoleDto } from './dto/create-los-role.dto';
import type { CreateLosUserDto } from './dto/create-los-user.dto';
import type { UpdateLosRoleDto } from './dto/update-los-role.dto';
import type { UpdateLosUserDto } from './dto/update-los-user.dto';

const USER_INCLUDE = {
  userRole: true,
  manager: { include: { userRole: true } },
} as const;

const DEFAULT_INVITE_TTL_HOURS = 7 * 24;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

type InvitationSecrets = {
  rawToken: string;
  invitationTokenHash: string;
  invitationSentAt: Date;
  invitationExpiresAt: Date;
};

@Injectable()
export class LosTeamService {
  private readonly logger = new Logger(LosTeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  private mapRole(role: UserWithRelations['userRole']): {
    id: number;
    name: string;
    hierarchyLevel: number;
    isActive: boolean;
  } | null {
    if (!role) return null;
    return {
      id: role.id,
      name: role.name,
      hierarchyLevel: role.hierarchyLevel,
      isActive: Boolean(role.isActive),
    };
  }

  private mapUser(user: UserWithRelations) {
    return {
      id: user.id.toString(),
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId,
      managerId: user.managerId?.toString() ?? null,
      manager: user.manager
        ? {
            id: user.manager.id.toString(),
            fullName: user.manager.fullName,
            email: user.manager.email,
            roleId: user.manager.roleId,
            userRole: this.mapRole(user.manager.userRole),
            isActive: user.manager.isActive,
          }
        : null,
      userRole: this.mapRole(user.userRole),
      isActive: user.isActive,
      invitationSentAt: user.invitationSentAt?.toISOString() ?? null,
      invitationExpiresAt: user.invitationExpiresAt?.toISOString() ?? null,
      registrationCompletedAt: user.registrationCompletedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private parseUserId(id: string): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException('Invalid user id');
    }
  }

  private async loadRole(roleId: number) {
    const role = await this.prisma.client.userRole.findUnique({ where: { id: roleId } });
    if (!role || !role.isActive) {
      throw new BadRequestException('Invalid or inactive role.');
    }
    return role;
  }

  private async assertManagerForRole(roleId: number, managerId: string | null | undefined) {
    const role = await this.loadRole(roleId);
    if (role.hierarchyLevel <= 1) {
      if (managerId) {
        throw new BadRequestException('This role does not use a line manager.');
      }
      return;
    }
    if (!managerId) {
      throw new BadRequestException('A line manager is required for this role.');
    }
    let managerNumeric: bigint;
    try {
      managerNumeric = BigInt(managerId);
    } catch {
      throw new BadRequestException('Invalid manager id.');
    }
    const manager = await this.prisma.client.user.findUnique({
      where: { id: managerNumeric },
      include: { userRole: true },
    });
    if (!manager?.isActive || !manager.registrationCompletedAt) {
      throw new BadRequestException('Manager must be an active user who has completed registration.');
    }
    const mLevel = manager.userRole?.hierarchyLevel;
    if (mLevel !== role.hierarchyLevel - 1) {
      throw new BadRequestException('Manager must be exactly one hierarchy level above this role.');
    }
  }

  async listRoles() {
    const rows = await this.prisma.read.userRole.findMany({
      orderBy: [{ hierarchyLevel: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hierarchyLevel: r.hierarchyLevel,
      isActive: Boolean(r.isActive),
    }));
  }

  async createRole(dto: CreateLosRoleDto) {
    try {
      const row = await this.prisma.client.userRole.create({
        data: {
          name: dto.name.trim(),
          hierarchyLevel: dto.hierarchyLevel,
          isActive: true,
        },
      });
      return { id: row.id, name: row.name, hierarchyLevel: row.hierarchyLevel, isActive: Boolean(row.isActive) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A role with this name already exists.');
      }
      throw error;
    }
  }

  async updateRole(id: number, dto: UpdateLosRoleDto) {
    const hasName = dto.name !== undefined;
    const hasLevel = dto.hierarchyLevel !== undefined;
    if (!hasName && !hasLevel) {
      throw new BadRequestException('Provide name and/or hierarchyLevel to update.');
    }
    const existing = await this.prisma.client.userRole.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    const data: { name?: string; hierarchyLevel?: number } = {};
    if (hasName) data.name = dto.name!.trim();
    if (hasLevel) data.hierarchyLevel = dto.hierarchyLevel;
    try {
      const row = await this.prisma.client.userRole.update({ where: { id }, data });
      return { id: row.id, name: row.name, hierarchyLevel: row.hierarchyLevel, isActive: Boolean(row.isActive) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A role with this name already exists.');
      }
      throw error;
    }
  }

  async toggleRoleStatus(id: number) {
    const existing = await this.prisma.client.userRole.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    const row = await this.prisma.client.userRole.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    return { id: row.id, name: row.name, hierarchyLevel: row.hierarchyLevel, isActive: Boolean(row.isActive) };
  }

  async listUsers() {
    const rows = await this.prisma.read.user.findMany({
      include: USER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((u) => this.mapUser(u));
  }

  private invitationTtlMs(): number {
    const raw = this.config.get<string>('LOS_INVITATION_EXPIRY_HOURS')?.trim();
    const hours = Number.parseInt(raw ?? '', 10);
    const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_INVITE_TTL_HOURS;
    return ttlHours * 60 * 60 * 1000;
  }

  private resolveLosFrontendUrl(): string | null {
    const raw = this.config.get<string>('LOS_FRONTEND_URL')?.trim();
    if (!raw) return null;
    return raw.replace(/\/+$/, '');
  }

  private assertInvitationEmailReady() {
    if (!this.emailService.isConfigured()) {
      throw new ServiceUnavailableException('Email is not configured; invitation cannot be sent.');
    }
    if (!this.resolveLosFrontendUrl()) {
      throw new ServiceUnavailableException('LOS_FRONTEND_URL is not configured; invitation cannot be sent.');
    }
  }

  private newInvitation(): InvitationSecrets {
    const rawToken = randomBytes(32).toString('base64url');
    const invitationTokenHash = createHash('sha256').update(rawToken).digest('hex');
    const invitationSentAt = new Date();
    const invitationExpiresAt = new Date(invitationSentAt.getTime() + this.invitationTtlMs());
    return { rawToken, invitationTokenHash, invitationSentAt, invitationExpiresAt };
  }

  private async sendInvitationEmail(params: {
    to: string;
    fullName: string;
    rawToken: string;
    expiresAt: Date;
  }) {
    this.assertInvitationEmailReady();
    const frontendUrl = this.resolveLosFrontendUrl();
    if (!frontendUrl) {
      throw new ServiceUnavailableException('LOS_FRONTEND_URL is not configured; invitation cannot be sent.');
    }
    const inviteUrl = `${frontendUrl}/invite/${params.rawToken}`;
    try {
      await this.emailService.sendLosInvitationEmail(params.to, {
        fullName: params.fullName,
        inviteUrl,
        expiresAt: params.expiresAt,
      });
      this.logger.log(`LOS invitation emailed to ${maskEmail(params.to)}.`);
    } catch (error) {
      this.logger.error(
        `Failed to email LOS invitation to ${maskEmail(params.to)}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'User was saved but the invitation email could not be sent. Use Resend invitation from the agents table.',
      );
    }
  }

  async createUser(dto: CreateLosUserDto) {
    const email = dto.email.trim().toLowerCase();
    await this.assertManagerForRole(dto.roleId, dto.managerId ?? null);
    this.assertInvitationEmailReady();

    const invite = this.newInvitation();

    try {
      const user = await this.prisma.client.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          roleId: dto.roleId,
          managerId:
            dto.managerId && dto.managerId.trim() !== ''
              ? BigInt(dto.managerId.trim())
              : null,
          isActive: true,
          password: null,
          invitationTokenHash: invite.invitationTokenHash,
          invitationSentAt: invite.invitationSentAt,
          invitationExpiresAt: invite.invitationExpiresAt,
        },
        include: USER_INCLUDE,
      });
      await this.sendInvitationEmail({
        to: email,
        fullName: user.fullName,
        rawToken: invite.rawToken,
        expiresAt: invite.invitationExpiresAt,
      });
      return this.mapUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }
  }

  async updateUser(id: string, dto: UpdateLosUserDto) {
    const userId = this.parseUserId(id);
    const hasAny =
      dto.fullName !== undefined
      || dto.email !== undefined
      || dto.roleId !== undefined
      || dto.managerId !== undefined;
    if (!hasAny) {
      throw new BadRequestException('Nothing to update.');
    }

    const existing = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: USER_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const nextRoleId = dto.roleId ?? existing.roleId;
    const targetRole = await this.loadRole(nextRoleId);

    let effectiveManagerId: string | null;
    if (targetRole.hierarchyLevel <= 1) {
      effectiveManagerId = null;
    } else if (dto.managerId !== undefined && dto.managerId !== null) {
      effectiveManagerId = dto.managerId.trim() !== '' ? dto.managerId.trim() : null;
    } else {
      effectiveManagerId = existing.managerId?.toString() ?? null;
    }

    await this.assertManagerForRole(nextRoleId, effectiveManagerId);

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.roleId !== undefined) data.roleId = dto.roleId;
    if (dto.roleId !== undefined || dto.managerId !== undefined) {
      data.managerId = effectiveManagerId === null ? null : BigInt(effectiveManagerId);
    }

    const emailChanging = dto.email !== undefined && dto.email.trim().toLowerCase() !== existing.email;
    const needsNewInvite = emailChanging && !existing.registrationCompletedAt;
    let invite: InvitationSecrets | null = null;
    if (needsNewInvite) {
      this.assertInvitationEmailReady();
      invite = this.newInvitation();
      data.invitationTokenHash = invite.invitationTokenHash;
      data.invitationSentAt = invite.invitationSentAt;
      data.invitationExpiresAt = invite.invitationExpiresAt;
    }

    try {
      const user = await this.prisma.client.user.update({
        where: { id: userId },
        data,
        include: USER_INCLUDE,
      });
      if (invite) {
        await this.sendInvitationEmail({
          to: user.email,
          fullName: user.fullName,
          rawToken: invite.rawToken,
          expiresAt: invite.invitationExpiresAt,
        });
      }
      return this.mapUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }
  }

  async toggleUserStatus(id: string) {
    const userId = this.parseUserId(id);
    const existing = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { isActive: !existing.isActive },
      include: USER_INCLUDE,
    });
    return this.mapUser(user);
  }

  async resendInvitation(id: string) {
    const userId = this.parseUserId(id);
    const existing = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (existing.password) {
      throw new BadRequestException('This user has already completed registration.');
    }
    this.assertInvitationEmailReady();
    const invite = this.newInvitation();
    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        invitationTokenHash: invite.invitationTokenHash,
        invitationSentAt: invite.invitationSentAt,
        invitationExpiresAt: invite.invitationExpiresAt,
      },
      include: USER_INCLUDE,
    });
    await this.sendInvitationEmail({
      to: user.email,
      fullName: user.fullName,
      rawToken: invite.rawToken,
      expiresAt: invite.invitationExpiresAt,
    });
    return this.mapUser(user);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) {
    return '***';
  }
  return `${local.slice(0, 2)}***@${domain}`;
}
