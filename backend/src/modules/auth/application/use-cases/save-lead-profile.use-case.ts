import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GENDER_SLUG_TO_DB, OCCUPATION_SLUG_TO_DB } from '../../../../common/mappers/lead-detail-master-slugs';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { SaveLeadProfileDto } from '../dto/save-lead-profile.dto';

function parseDobUtc(dob: string): Date {
  const [y, m, d] = dob.split('-').map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid date of birth.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class SaveLeadProfileUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, dto: SaveLeadProfileDto): Promise<{ success: true; leadUuid: string }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(customer.id);

    if (!leadRow) {
      throw new NotFoundException('No matching active lead was found.');
    }

    const genderName = GENDER_SLUG_TO_DB[dto.gender];
    const occupationName = OCCUPATION_SLUG_TO_DB[dto.occupation];
    if (!genderName || !occupationName) {
      throw new BadRequestException('Invalid gender or occupation.');
    }

    const [gender, occupation] = await Promise.all([
      this.prisma.client.gender.findUnique({ where: { name: genderName }, select: { id: true } }),
      this.prisma.client.occupation.findUnique({ where: { name: occupationName }, select: { id: true } }),
    ]);

    if (!gender || !occupation) {
      throw new BadRequestException('Gender or occupation is not available in the system.');
    }

    const dateOfBirth = parseDobUtc(dto.dob);
    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);
    const panUpper = dto.panNumber.trim().toUpperCase();

    const profilePayload = {
      fullName: dto.fullName.trim(),
      dateOfBirth,
      genderId: gender.id,
      occupationId: occupation.id,
      netMonthlyIncome,
      annualTurnover,
      annualProfit,
      ...(dto.creditConsentAccepted === true ? { cibilConsentAt: new Date() } : {}),
    };

    await this.prisma.client.leadDetail.upsert({
      where: { leadId: leadRow.id },
      create: {
        leadId: leadRow.id,
        ...profilePayload,
      },
      update: profilePayload,
    });

    await this.prisma.client.lead.update({
      where: { id: leadRow.id },
      data: { panNumber: panUpper },
    });

    return { success: true, leadUuid: leadRow.uuid };
  }
}
