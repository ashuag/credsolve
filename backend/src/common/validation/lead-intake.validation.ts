import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { OCCUPATION } from '../constants/occupation.constants';

/** Minimum annual turnover for self-employed applicants (INR). */
export const MIN_ANNUAL_TURNOVER = 120_000;

/** Minimum annual profit for self-employed applicants (INR). */
export const MIN_ANNUAL_PROFIT = 10_000;

const ADDRESS_ALLOWED_PATTERN = /^[\p{L}\p{N} .,#\-/]+$/u;

const SELF_EMPLOYED_KEYS = new Set<string>([
  OCCUPATION.SELF_EMPLOYED_PROFESSIONAL.key,
  OCCUPATION.SELF_EMPLOYED_BUSINESS.key,
]);

const MONTHLY_INCOME_KEYS = new Set<string>([
  OCCUPATION.SALARIED.key,
  OCCUPATION.STUDENT.key,
  OCCUPATION.HOMEMAKER.key,
  OCCUPATION.RETIRED.key,
]);

export function validateAddressLine1(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 5) {
    return 'Address line 1 must be at least 5 characters.';
  }
  if (!ADDRESS_ALLOWED_PATTERN.test(trimmed)) {
    return 'Address may only contain letters, numbers, spaces, and . , # - / characters.';
  }
  if (!/\d/.test(trimmed) && trimmed.length < 10) {
    return 'Enter a complete address (at least 10 characters or include a house/flat number).';
  }
  return null;
}

export function validateOccupationIncome(
  occupationKey: string,
  amounts: {
    monthlyIncome?: number | null;
    annualTurnover?: number | null;
    annualProfit?: number | null;
  },
): string | null {
  if (occupationKey === OCCUPATION.SALARIED.key) {
    const income = amounts.monthlyIncome;
    if (income == null || !Number.isFinite(income)) {
      return 'Monthly income is required for salaried applicants.';
    }
    if (income < 0) {
      return 'Monthly income must be a valid amount (0 is allowed).';
    }
    return null;
  }

  if (SELF_EMPLOYED_KEYS.has(occupationKey)) {
    const turnover = amounts.annualTurnover;
    const profit = amounts.annualProfit;
    if (turnover == null || !Number.isFinite(turnover) || turnover < MIN_ANNUAL_TURNOVER) {
      return `Annual turnover must be at least ₹${MIN_ANNUAL_TURNOVER.toLocaleString('en-IN')}.`;
    }
    if (profit == null || !Number.isFinite(profit) || profit < MIN_ANNUAL_PROFIT) {
      return `Annual profit must be at least ₹${MIN_ANNUAL_PROFIT.toLocaleString('en-IN')}.`;
    }
    return null;
  }

  if (MONTHLY_INCOME_KEYS.has(occupationKey)) {
    const income = amounts.monthlyIncome;
    if (income == null || !Number.isFinite(income) || income < 0) {
      return 'Monthly income must be a valid amount (0 is allowed).';
    }
  }

  return null;
}

export async function assertPincodeMatchesCity(
  prisma: PrismaService['client'],
  pincode: string,
  cityId: number,
): Promise<void> {
  const row = await prisma.pincode.findFirst({
    where: { code: pincode.trim(), isActive: true },
    select: { cityId: true },
  });
  if (!row) return;

  if (row.cityId !== cityId) {
    throw new BadRequestException(
      'Pincode does not match the selected city. Check your pincode and city, then try again.',
    );
  }
}

export function throwIfLeadIntakeInvalid(message: string | null): void {
  if (message) {
    throw new BadRequestException(message);
  }
}
