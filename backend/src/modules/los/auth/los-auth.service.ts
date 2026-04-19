import { createHash } from 'node:crypto';
import { GoneException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LosLoginDto } from './dto/login.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { LosSessionService } from './los-session.service';
import { serializeLosUser } from './serialize-los-user';

@Injectable()
export class LosAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly losSession: LosSessionService
  ) {}

  async login(dto: LosLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: { userRole: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Complete your registration from the invitation email first.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account is inactive.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const loggedInUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { userRole: true },
    });

    const serializedUser = serializeLosUser(loggedInUser);
    const token = await this.losSession.createSession({
      userId: serializedUser.id,
      email: serializedUser.email,
      roleId: serializedUser.roleId,
      roleName: serializedUser.roleName,
    });

    return {
      user: serializedUser,
      token,
    };
  }

  async getInvitation(token: string) {
    const user = await this.findValidInvitation(token);

    return {
      fullName: user.fullName,
      email: user.email,
      roleName: user.userRole?.name ?? null,
      expiresAt: user.invitationExpiresAt!.toISOString(),
    };
  }

  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    const user = await this.findValidInvitation(token);
    const password = await bcrypt.hash(dto.password, 10);

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        password,
        isActive: true,
        invitationTokenHash: null,
        invitationSentAt: null,
        invitationExpiresAt: null,
        registrationCompletedAt: new Date(),
      },
    });

    return {
      message: 'Password set successfully. You can now sign in.',
    };
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const id = BigInt(userId);
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, password: true, isActive: true },
    });

    if (!user || !user.isActive || !user.password) {
      throw new UnauthorizedException('Invalid user session');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { password: newPasswordHash },
    });

    return { success: true };
  }

  private async findValidInvitation(token: string) {
    const invitationTokenHash = createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.client.user.findUnique({
      where: { invitationTokenHash },
      include: { userRole: true },
    });

    if (
      !user ||
      !user.invitationExpiresAt ||
      user.invitationExpiresAt.getTime() <= Date.now()
    ) {
      throw new GoneException('Password setup link has expired.');
    }

    return user;
  }
}
