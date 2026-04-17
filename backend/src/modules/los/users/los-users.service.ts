import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { serializeLosUser, serializeLosUsers } from '../utils/serialize-los-user';
import { LosUserInvitationService } from './los-user-invitation.service';

const ROLE_SELECT = {
  id: true,
  name: true,
  hierarchyLevel: true,
  isActive: true,
} as const;

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
} as const;

@Injectable()
export class LosUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly losUserInvitationService: LosUserInvitationService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return serializeLosUsers(users);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists');
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

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    const nextRoleId = dto.roleId ?? user.roleId;
    const nextManagerInput = dto.managerId !== undefined ? dto.managerId : user.managerId;
    const managerId = await this.resolveManagerAssignment(nextRoleId, nextManagerInput, id);
    const emailChanged = dto.email !== undefined && dto.email !== user.email;

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data['fullName'] = dto.fullName;
    if (dto.email !== undefined) {
      data['email'] = dto.email;

      // Changing the email for a pending user invalidates any previously sent link.
      if (!user.registrationCompletedAt && emailChanged) {
        data['invitationTokenHash'] = null;
        data['invitationSentAt'] = null;
        data['invitationExpiresAt'] = null;
      }
    }
    if (dto.roleId !== undefined) data['roleId'] = dto.roleId;
    if (dto.managerId !== undefined || nextRoleId !== user.roleId) {
      data['managerId'] = managerId;
    }

    const updatedUser = await this.prisma.user.update({ where: { id }, data, select: USER_SELECT });

    if (!user.registrationCompletedAt && emailChanged) {
      return this.issueInvitation(updatedUser.id);
    }

    return serializeLosUser(updatedUser);
  }

  async toggleStatus(id: number) {
    const user = await this.findOne(id);
    if (!user.registrationCompletedAt) {
      throw new ConflictException('Pending agents become active only after setting their password.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: USER_SELECT,
    });

    return serializeLosUser(updatedUser);
  }

  async resendInvitation(id: number) {
    const user = await this.findOne(id);

    if (user.registrationCompletedAt) {
      throw new ConflictException('This agent is already active.');
    }

    return this.issueInvitation(user.id);
  }

  private async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  private async resolveManagerAssignment(
    roleId: number,
    managerIdInput?: string | bigint | null,
    currentUserId?: number,
  ): Promise<bigint | null> {
    const role = await this.prisma.userRole.findUnique({
      where: { id: roleId },
      select: ROLE_SELECT,
    });
    if (!role) throw new NotFoundException(`Role #${roleId} not found`);

    if (role.hierarchyLevel === 1) {
      if (currentUserId === undefined && managerIdInput !== undefined && managerIdInput !== null) {
        throw new BadRequestException('Top-level roles cannot have an assigned manager.');
      }

      return null as bigint | null;
    }

    const managerId = this.parseUserId(managerIdInput);
    if (!managerId) {
      throw new BadRequestException(`Select a reporting manager from hierarchy level ${role.hierarchyLevel - 1}.`);
    }

    if (currentUserId !== undefined && managerId === BigInt(currentUserId)) {
      throw new BadRequestException('An agent cannot report to themselves.');
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
      throw new NotFoundException('Selected manager not found.');
    }

    if (!manager.userRole || manager.userRole.hierarchyLevel !== role.hierarchyLevel - 1) {
      throw new BadRequestException(`Selected manager must belong to hierarchy level ${role.hierarchyLevel - 1}.`);
    }

    if (!manager.userRole.isActive || !manager.isActive || !manager.password) {
      throw new BadRequestException('Selected manager must be an active registered agent.');
    }

    return managerId;
  }

  private hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseUserId(value?: string | bigint | null) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'bigint') {
      return value;
    }

    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('Invalid manager ID.');
    }

    return BigInt(value);
  }

  private async issueInvitation(userId: bigint) {
    const invitationToken = randomBytes(32).toString('base64url');
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

    return serializeLosUser(user);
  }

  private buildInvitationLink(token: string) {
    const baseUrl = this.configService.get<string>('LOS_FRONTEND_URL')?.trim();
    if (!baseUrl) {
      throw new InternalServerErrorException('LOS_FRONTEND_URL is not configured.');
    }

    return `${baseUrl.replace(/\/+$/, '')}/invite/${token}`;
  }

  private getInvitationExpiryHours() {
    const rawValue = this.configService.get<string>('LOS_INVITATION_EXPIRY_HOURS')?.trim();
    const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }

    return 24;
  }
}
