import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { VerifyPanDto } from '../dto/verify-pan.dto';

function parseDobUtc(dob: string): Date {
  const [y, m, d] = dob.split('-').map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid date of birth.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

export type VerifyPanResult = {
  success: true;
  matched: boolean;
  panVerified: boolean;
  vendorFullName: string | null;
};

/**
 * Persists PAN + name + DOB on lead_detail. Third-party Tenacio `pan-name-dob` verification is
 * turned off for now — re-enable by restoring the vendor call + `vendor_api_log` write from git history.
 */
@Injectable()
export class VerifyPanUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(req: Request, dto: VerifyPanDto): Promise<VerifyPanResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(undefined, dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(undefined, customer.id);

    if (!leadRow) {
      throw new NotFoundException('No matching active lead was found.');
    }

    const panUpper = dto.panNumber.trim().toUpperCase();
    const fullNameTrimmed = dto.fullName.trim();
    const dateOfBirth = parseDobUtc(dto.dob);

    await this.prisma.client.leadDetail.upsert({
      where: { leadId: leadRow.id },
      create: {
        leadId: leadRow.id,
        panNumber: panUpper,
        fullName: fullNameTrimmed,
        dateOfBirth,
      },
      update: {
        panNumber: panUpper,
        fullName: fullNameTrimmed,
        dateOfBirth,
      },
    });

    return {
      success: true,
      matched: true,
      panVerified: false,
      vendorFullName: null,
    };
  }
}
