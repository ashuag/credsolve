import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  assertPincodeMatchesCity,
  throwIfLeadIntakeInvalid,
  validateAddressLine1,
  validateOccupationIncome,
} from '../../../../common/validation/lead-intake.validation';
import { resolveLeadCityId } from '../../../../common/utils/resolve-lead-city-id.util';
import { resolveGenderOccupationIds } from '../../../../common/utils/resolve-gender-occupation-ids.util';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { recurringLockedIdentityFromPriorDetail } from '../../../../common/lead/recurring-customer-identity.util';
import { isValidContactEmail, normalizeEmail } from '../../infrastructure/utils/email.util';
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

    const priorIdentity = recurringLockedIdentityFromPriorDetail(
      await this.leads.findLatestPriorLeadDetailForCustomer(customer.id, leadRow.id),
    );

    const { genderId, occupationId } = await resolveGenderOccupationIds(
      this.prisma.client,
      dto.gender,
      dto.occupation,
    );

    const emailId = normalizeEmail(dto.emailId);
    if (!isValidContactEmail(emailId)) {
      throw new BadRequestException('Please enter a valid email address.');
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

    const dateOfBirth = priorIdentity?.dateOfBirth ?? parseDobUtc(dto.dob);
    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);
    const lockedFullName = priorIdentity?.fullName ?? dto.fullName.trim();
    const lockedGenderId = priorIdentity?.genderId ?? genderId;

    const consentAt = dto.creditConsentAccepted ? new Date() : null;
    const panUpper =
      priorIdentity?.panNumber ??
      (dto.panNumber?.trim() != null && dto.panNumber.trim().length > 0
        ? dto.panNumber.trim().toUpperCase()
        : null);

    await this.prisma.client.leadDetail.upsert({
      where: { leadId: leadRow.id },
      create: {
        leadId: leadRow.id,
        fullName: lockedFullName,
        dateOfBirth,
        genderId: lockedGenderId,
        occupationId,
        cityId,
        pincode: dto.pincode,
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        emailId,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        cibilConsentAt: consentAt,
        ...(panUpper ? { panNumber: panUpper } : {}),
      },
      update: {
        fullName: lockedFullName,
        dateOfBirth,
        genderId: lockedGenderId,
        occupationId,
        cityId,
        pincode: dto.pincode,
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        emailId,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        cibilConsentAt: consentAt,
        ...(panUpper ? { panNumber: panUpper } : {}),
      },
    });

    return { success: true, leadUuid: leadRow.uuid };
  }
}
