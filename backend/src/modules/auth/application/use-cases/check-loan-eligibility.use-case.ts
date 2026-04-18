import { Injectable } from '@nestjs/common';

const MIN_INR = 5_000;
const MAX_INR = 50_000;

export type LoanEligibilityResult = {
  /** Pre-approved offer ceiling in whole INR (demo: random in [5_000, 50_000]). */
  preApprovedAmountInr: number;
};

/**
 * Placeholder eligibility: returns a random approved ceiling between ₹5,000 and ₹50,000.
 * Replace with real bureau / rules engine integration when ready.
 */
@Injectable()
export class CheckLoanEligibilityUseCase {
  execute(): LoanEligibilityResult {
    const span = MAX_INR - MIN_INR + 1;
    const preApprovedAmountInr = MIN_INR + Math.floor(Math.random() * span);
    return { preApprovedAmountInr };
  }
}
