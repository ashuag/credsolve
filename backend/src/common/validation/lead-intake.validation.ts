import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

const ADDRESS_ALLOWED_PATTERN = /^[\p{L}\p{N} .,#\-/]+$/u;

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
  if (!occupationKey) {
    return 'Occupation is required.';
  }

  const income = amounts.monthlyIncome;
  if (income == null || !Number.isFinite(income)) {
    return 'Monthly income is required.';
  }
  if (income < 0) {
    return 'Monthly income must be a valid amount (0 is allowed).';
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
