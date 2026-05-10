import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { GENDER } from '../../../../common/constants/gender.constants';
import { OCCUPATION } from '../../../../common/constants/occupation.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { SaveLeadDetailsDto } from '../dto/save-lead-details.dto';

const GENDER_SLUG_TO_DB: Record<string, string> = {
  male: GENDER.MALE,
  female: GENDER.FEMALE,
  others: GENDER.OTHERS,
};

const OCC_SLUG_TO_DB: Record<string, string> = {
  salaried: OCCUPATION.SALARIED,
  self_employed_professional: OCCUPATION.SELF_EMPLOYED_PROFESSIONAL,
  self_employed_business: OCCUPATION.SELF_EMPLOYED_BUSINESS,
  student: OCCUPATION.STUDENT,
  homemaker: OCCUPATION.HOMEMAKER,
  retired: OCCUPATION.RETIRED,
};

function parseOptionalInrAmount(raw: string | undefined): Prisma.Decimal | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return new Prisma.Decimal(digits);
}

function parseDobUtc(dob: string): Date {
  const [y, m, d] = dob.split('-').map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid date of birth.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class SaveLeadDetailsUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService
  ) {}

  async execute(req: Request, dto: SaveLeadDetailsDto): Promise<{ success: true; leadUuid: string }> {
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

    const genderName = GENDER_SLUG_TO_DB[dto.gender];
    const occupationName = OCC_SLUG_TO_DB[dto.occupation];
    if (!genderName || !occupationName) {
      throw new BadRequestException('Invalid gender or occupation.');
    }

    const [gender, occupation] = await Promise.all([
      this.prisma.client.gender.findUnique({
        where: { name: genderName },
        select: { id: true },
      }),
      this.prisma.client.occupation.findUnique({
        where: { name: occupationName },
        select: { id: true },
      }),
    ]);

    if (!gender || !occupation) {
      throw new BadRequestException('Gender or occupation is not available in the system.');
    }

    const cityId = await this.resolveCityId(dto.currentCity.trim());
    if (cityId == null) {
      throw new BadRequestException(
        'Could not resolve your city. Pick a city from the suggestions list and try again.'
      );
    }

    const dateOfBirth = parseDobUtc(dto.dob);
    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);

    const consentAt = dto.creditConsentAccepted ? new Date() : null;
    const panPatch =
      dto.panNumber?.trim() != null && dto.panNumber.trim().length > 0
        ? { panNumber: dto.panNumber.trim().toUpperCase() }
        : {};

    await this.prisma.client.leadDetail.upsert({
      where: { leadId: leadRow.id },
      create: {
        leadId: leadRow.id,
        fullName: dto.fullName.trim(),
        dateOfBirth,
        genderId: gender.id,
        occupationId: occupation.id,
        cityId,
        pincode: dto.pincode,
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        cibilConsentAt: consentAt,
        ...panPatch,
      },
      update: {
        fullName: dto.fullName.trim(),
        dateOfBirth,
        genderId: gender.id,
        occupationId: occupation.id,
        cityId,
        pincode: dto.pincode,
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        cibilConsentAt: consentAt,
        ...panPatch,
      },
    });

    return { success: true, leadUuid: leadRow.uuid };
  }

  private async resolveCityId(raw: string): Promise<number | null> {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const cityName = parts[0]!;
      const stateCode = parts[parts.length - 1]!.toUpperCase();
      const row = await this.prisma.client.city.findFirst({
        where: {
          name: cityName,
          isActive: true,
          state: { code: stateCode },
        },
        select: { id: true },
      });
      if (row) {
        return row.id;
      }
    }

    const single = await this.prisma.client.city.findFirst({
      where: { name: raw, isActive: true },
      select: { id: true },
    });
    return single?.id ?? null;
  }
}
