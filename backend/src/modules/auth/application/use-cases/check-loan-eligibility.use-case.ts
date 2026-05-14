import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

export type LoanEligibilityResult = {
  /** Pre-approved offer ceiling in whole INR (deterministic from seed; clamped to settings min/max). */
  preApprovedAmountInr: number;
  /** Bounds from `MIN_LOAN_AMOUNT` / `MAX_LOAN_AMOUNT` settings (same as `GET /loans/settings`). */
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
};

function hashStringToUint32(s: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

/**
 * Demo pre-approval: maps a stable seed (e.g. lead UUID) to an amount in
 * [`MIN_LOAN_AMOUNT`, `MAX_LOAN_AMOUNT`] from settings. Same seed always yields
 * the same ceiling so `GET /loans/eligibility` matches amounts computed during
 * application submit. Replace with bureau / rules engine when ready.
 */
@Injectable()
export class CheckLoanEligibilityUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly settings: SettingsRepository,
  ) {}

  /** Use when the active lead UUID is already known (e.g. professional submit). */
  async computeForSeed(seed: string): Promise<LoanEligibilityResult> {
    const { minLoanAmount, maxLoanAmount } = await this.settings.loadLoanCalculationSettings();
    const minInr = Math.max(1, Math.floor(minLoanAmount));
    const maxInr = Math.max(minInr, Math.floor(maxLoanAmount));
    const span = maxInr - minInr + 1;
    const raw = minInr + (hashStringToUint32(seed) % span);
    const preApprovedAmountInr = Math.min(maxInr, Math.max(minInr, raw));
    return { preApprovedAmountInr, minLoanAmountInr: minInr, maxLoanAmountInr: maxInr };
  }

  /**
   * Resolves the signed-in customer’s active lead and derives the same
   * pre-approved ceiling the UI uses on `/pre-approved-loan`.
   */
  async executeForCustomerSession(req: Request): Promise<LoanEligibilityResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
    const seed = lead?.uuid ?? `customer:${customer.id.toString()}`;
    return await this.computeForSeed(seed);
  }
}
