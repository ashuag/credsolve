import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

@Injectable()
export class LeadDetailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveGenderIdByName(name: string, session?: DatabaseSession): Promise<number | null> {
    const client = session?.tx ?? this.prisma;
    const gender = await client.gender.findFirst({
      where: {
        isActive: true,
        name
      },
      select: { id: true }
    });

    return gender?.id ?? null;
  }

  async findActiveCityIdByName(name: string, session?: DatabaseSession): Promise<number | null> {
    const client = session?.tx ?? this.prisma;
    const city = await client.city.findFirst({
      where: {
        isActive: true,
        name
      },
      select: { id: true }
    });

    return city?.id ?? null;
  }

  async findActiveOccupationIdByName(name: string, session?: DatabaseSession): Promise<number | null> {
    const client = session?.tx ?? this.prisma;
    const occupation = await client.occupation.findFirst({
      where: {
        isActive: true,
        name
      },
      select: { id: true }
    });

    return occupation?.id ?? null;
  }

  async findPersonalDetailsByLeadId(
    leadId: bigint,
    session?: DatabaseSession,
  ): Promise<{
    fullName: string | null;
    dateOfBirth: Date | null;
    panNumber: string | null;
    cityId: number | null;
    pincode: string | null;
  } | null> {
    const client = session?.tx ?? this.prisma;
    const row = await client.leadDetail.findUnique({
      where: { leadId },
      select: { fullName: true, dateOfBirth: true, panNumber: true, cityId: true, pincode: true },
    });
    return row ?? null;
  }

  async upsertPersonalDetails(params: {
    leadId: bigint;
    fullName: string;
    dateOfBirth: Date;
    genderId: number;
    panNumber?: string | null;
    addressLine1: string;
    addressLine2: string | null;
    cityId: number;
    pincode: string;
  }, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;

    await client.leadDetail.upsert({
      where: { leadId: params.leadId },
      update: {
        fullName: params.fullName,
        dateOfBirth: params.dateOfBirth,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        pincode: params.pincode,
        ...(params.panNumber !== undefined ? { panNumber: params.panNumber } : {}),
        city: {
          connect: { id: params.cityId }
        },
        gender: {
          connect: { id: params.genderId }
        }
      },
      create: {
        fullName: params.fullName,
        dateOfBirth: params.dateOfBirth,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        pincode: params.pincode,
        ...(params.panNumber !== undefined ? { panNumber: params.panNumber } : {}),
        lead: {
          connect: { id: params.leadId }
        },
        city: {
          connect: { id: params.cityId }
        },
        gender: {
          connect: { id: params.genderId }
        }
      }
    });
  }

  async upsertProfessionalDetails(params: {
    leadId: bigint;
    cityId: number;
    pincode: string;
    occupationId: number;
    monthlyIncome: string | null;
    annualTurnover: string | null;
    annualProfit: string | null;
    cibilConsentAt?: Date | null;
  }, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;
    const netMonthlyIncome = params.monthlyIncome ? new Prisma.Decimal(params.monthlyIncome) : null;
    const annualTurnover = params.annualTurnover ? new Prisma.Decimal(params.annualTurnover) : null;
    const annualProfit = params.annualProfit ? new Prisma.Decimal(params.annualProfit) : null;

    await client.leadDetail.upsert({
      where: { leadId: params.leadId },
      update: {
        city: {
          connect: { id: params.cityId }
        },
        pincode: params.pincode,
        occupation: {
          connect: { id: params.occupationId }
        },
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        ...(params.cibilConsentAt !== undefined ? { cibilConsentAt: params.cibilConsentAt } : {})
      },
      create: {
        pincode: params.pincode,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        ...(params.cibilConsentAt !== undefined ? { cibilConsentAt: params.cibilConsentAt } : {}),
        lead: {
          connect: { id: params.leadId }
        },
        city: {
          connect: { id: params.cityId }
        },
        occupation: {
          connect: { id: params.occupationId }
        }
      }
    });
  }

  async upsertOnboardingDetails(params: {
    leadId: bigint;
    fullName: string;
    dateOfBirth: Date;
    genderId: number;
    addressLine1: string;
    addressLine2: string | null;
    cityId: number;
    pincode: string;
    occupationId: number;
    monthlyIncome: string | null;
    annualTurnover: string | null;
    annualProfit: string | null;
    cibilConsentAt: Date | null;
  }, session?: DatabaseSession): Promise<void> {
    const client = session?.tx ?? this.prisma;
    const netMonthlyIncome = params.monthlyIncome ? new Prisma.Decimal(params.monthlyIncome) : null;
    const annualTurnover = params.annualTurnover ? new Prisma.Decimal(params.annualTurnover) : null;
    const annualProfit = params.annualProfit ? new Prisma.Decimal(params.annualProfit) : null;

    await client.leadDetail.upsert({
      where: { leadId: params.leadId },
      update: {
        fullName: params.fullName,
        dateOfBirth: params.dateOfBirth,
        gender: {
          connect: { id: params.genderId }
        },
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        city: {
          connect: { id: params.cityId }
        },
        pincode: params.pincode,
        occupation: {
          connect: { id: params.occupationId }
        },
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        cibilConsentAt: params.cibilConsentAt
      },
      create: {
        fullName: params.fullName,
        dateOfBirth: params.dateOfBirth,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        pincode: params.pincode,
        netMonthlyIncome,
        annualTurnover,
        annualProfit,
        cibilConsentAt: params.cibilConsentAt,
        lead: {
          connect: { id: params.leadId }
        },
        gender: {
          connect: { id: params.genderId }
        },
        city: {
          connect: { id: params.cityId }
        },
        occupation: {
          connect: { id: params.occupationId }
        }
      }
    });
  }
}
