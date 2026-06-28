import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { GENDER } from '../../../../common/constants/gender.constants';
import { OCCUPATION } from '../../../../common/constants/occupation.constants';

const GENDER_KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.values(GENDER).map(({ key, name }) => [key, name]),
);
const OCCUPATION_KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.values(OCCUPATION).map(({ key, name }) => [key, name]),
);
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  assertPincodeMatchesCity,
  throwIfLeadIntakeInvalid,
  validateAddressLine1,
  validateOccupationIncome,
} from '../../../../common/validation/lead-intake.validation';
import { resolveLeadCityId } from '../../../../common/utils/resolve-lead-city-id.util';
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

    const genderName = GENDER_KEY_TO_NAME[dto.gender];
    const occupationName = OCCUPATION_KEY_TO_NAME[dto.occupation];
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

    throwIfLeadIntakeInvalid(validateAddressLine1(dto.addressLine1));
    throwIfLeadIntakeInvalid(
      validateOccupationIncome(dto.occupation, {
        monthlyIncome: parseOptionalInrAmount(dto.monthlyIncome)?.toNumber() ?? null,
        annualTurnover: parseOptionalInrAmount(dto.annualTurnover)?.toNumber() ?? null,
        annualProfit: parseOptionalInrAmount(dto.annualProfit)?.toNumber() ?? null,
      }),
    );

    const cityId = await resolveLeadCityId(this.prisma.client, {
      currentCityId: dto.currentCityId ?? null,
      currentCity: dto.currentCity,
    });
    if (cityId == null) {
      throw new BadRequestException(
        'Could not resolve your city. Pick a city from the suggestions list and try again.',
      );
    }

    await assertPincodeMatchesCity(this.prisma.client, dto.pincode, cityId);

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
}
