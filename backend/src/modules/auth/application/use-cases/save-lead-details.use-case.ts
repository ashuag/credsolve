import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { GENDER_SLUG_TO_DB, OCCUPATION_SLUG_TO_DB } from '../../../../common/mappers/lead-detail-master-slugs';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { SaveLeadDetailsDto } from '../dto/save-lead-details.dto';

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

    let cityId: number | null = null;
    if (dto.currentCityId != null) {
      const byId = await this.prisma.client.city.findFirst({
        where: { id: dto.currentCityId, isActive: true },
        select: { id: true },
      });
      if (!byId) {
        throw new BadRequestException(
          'That city selection is no longer valid. Open the city list and pick your city again.',
        );
      }
      cityId = byId.id;
    } else {
      cityId = await this.resolveCityId(dto.currentCity.trim());
    }
    if (cityId == null) {
      throw new BadRequestException(
        'Could not resolve your city. Pick a city from the suggestions list and try again.',
      );
    }

    const dateOfBirth = parseDobUtc(dto.dob);
    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);

    const consentAt = dto.creditConsentAccepted ? new Date() : null;
    const panUpper =
      dto.panNumber?.trim() != null && dto.panNumber.trim().length > 0
        ? dto.panNumber.trim().toUpperCase()
        : null;

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
      },
    });

    if (panUpper) {
      await this.prisma.client.lead.update({
        where: { id: leadRow.id },
        data: { panNumber: panUpper },
      });
    }

    return { success: true, leadUuid: leadRow.uuid };
  }

  private async resolveCityId(raw: string): Promise<number | null> {
    const normalized = raw.replace(/\s+/g, ' ').trim();
    const parts = normalized
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const cityName = parts[0]!;
      const stateSegment = parts[parts.length - 1]!.trim();
      const stateCode = stateSegment.length <= 3 ? stateSegment.toUpperCase() : null;

      if (stateCode) {
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

      const state = await this.prisma.client.state.findFirst({
        where: {
          isActive: true,
          OR: [
            ...(stateCode ? [{ code: stateCode }] : []),
            { name: stateSegment },
          ],
        },
        select: { id: true },
      });
      if (state) {
        const row = await this.prisma.client.city.findFirst({
          where: { name: cityName, isActive: true, stateId: state.id },
          select: { id: true },
        });
        if (row) {
          return row.id;
        }
      }
    }

    const single = await this.prisma.client.city.findFirst({
      where: { name: normalized, isActive: true },
      select: { id: true },
    });
    return single?.id ?? null;
  }
}
