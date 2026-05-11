import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { EmailVerificationType } from '@prisma/client';
import { verifyGoogleIdTokenEmail } from '../../infrastructure/google/google-oauth-http.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { SyncLeadEmailDto } from '../dto/sync-lead-email.dto';

@Injectable()
export class SyncLeadEmailFromGoogleTokenUseCase {
  constructor(
    private readonly config: ConfigService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(req: Request, dto: SyncLeadEmailDto): Promise<{ success: true; leadUuid: string }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID is not configured.');
    }

    let email: string;
    try {
      const verified = await verifyGoogleIdTokenEmail(dto.googleIdToken, clientId);
      email = verified.email;
    } catch {
      throw new BadRequestException('Invalid or expired Google token.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) {
      throw new BadRequestException('No active lead for this account. Complete mobile verification first.');
    }
    if (dto.leadUuid && dto.leadUuid !== lead.uuid) {
      throw new BadRequestException('Lead does not match your current application.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      await this.leads.updateLeadEmailWithVerification(lead.id, email, EmailVerificationType.GOOGLE, tx);
      await this.leads.applyInProgressAfterEmailVerified(lead, tx);
    });

    return { success: true, leadUuid: lead.uuid };
  }
}
