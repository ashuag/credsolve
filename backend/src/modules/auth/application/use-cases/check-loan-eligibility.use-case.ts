import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';

const MIN_INR = 5_000;
const MAX_INR = 50_000;

export type LoanEligibilityResult = {
  /** Pre-approved offer ceiling in whole INR (deterministic from seed until real rules exist). */
  preApprovedAmountInr: number;
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
 * [MIN_INR, MAX_INR]. Same seed always yields the same ceiling so
 * `GET /loans/eligibility` matches amounts computed during application submit.
 * Replace with bureau / rules engine when ready.
 */
@Injectable()
export class CheckLoanEligibilityUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
  ) {}

  /** Use when the active lead UUID is already known (e.g. professional submit). */
  computeForSeed(seed: string): LoanEligibilityResult {
    const span = MAX_INR - MIN_INR + 1;
    const preApprovedAmountInr = MIN_INR + (hashStringToUint32(seed) % span);
    return { preApprovedAmountInr };
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
    return this.computeForSeed(seed);
  }
}
