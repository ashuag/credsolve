import { createHash } from 'node:crypto';
import { GoneException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LosLoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { serializeLosUser } from '../utils/serialize-los-user';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Injectable()
export class LosAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LosLoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRole: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password) {
      throw new UnauthorizedException('Complete your registration from the invitation email first.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account is inactive.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const loggedInUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { userRole: true },
    });

    const serializedUser = serializeLosUser(loggedInUser);
    const payload = {
      sub: serializedUser.id,
      email: serializedUser.email,
      roleId: serializedUser.roleId,
      roleName: serializedUser.userRole?.name ?? null,
    };

    return {
      user: {
        id: serializedUser.id,
        fullName: serializedUser.fullName,
        email: serializedUser.email,
        roleId: serializedUser.roleId,
        roleName: serializedUser.userRole?.name ?? null,
      },
      token: await this.jwtService.signAsync(payload),
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

    await this.prisma.user.update({
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

  private async findValidInvitation(token: string) {
    const invitationTokenHash = this.hashInvitationToken(token);
    const user = await this.prisma.user.findUnique({
      where: { invitationTokenHash },
      include: { userRole: true },
    });

    if (
      !user
      || !user.invitationExpiresAt
      || user.invitationExpiresAt.getTime() <= Date.now()
    ) {
      throw new GoneException('Password setup link has expired.');
    }

    return user;
  }

  private hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
