import { completedAgeYearsIst, istCalendarDateUtc } from '../loan/loan-calculation.util';
import { isoDateOnlyUtc } from '../loan/repayment-due-date.util';

export type PreBreAgeVerdict =
  | { passed: true; currentAge: number; ageAtTenureEnd: number }
  | {
      passed: false;
      code: 'MIN_AGE_BRE_FAILED' | 'MAX_AGE_BRE_FAILED';
      currentAge: number;
      ageAtTenureEnd: number;
      detail: string;
    };

/**
 * MAX_AGE is exclusive: completed age must be less than maxAge both today (IST)
 * and on the repayment date. A configured max of 58 rejects 58y+.
 */
export function evaluatePreBreAge(input: {
  dateOfBirth: Date;
  asOf?: Date;
  tenureEnd: Date;
  minAge: number;
  maxAge: number;
}): PreBreAgeVerdict {
  const asOf = input.asOf ?? new Date();
  const currentAge = completedAgeYearsIst(input.dateOfBirth, asOf);
  const ageAtTenureEnd = completedAgeYearsIst(input.dateOfBirth, input.tenureEnd);
  const dobIso = isoDateOnlyUtc(istCalendarDateUtc(input.dateOfBirth));
  const tenureEndIso = isoDateOnlyUtc(istCalendarDateUtc(input.tenureEnd));
  const oldestAge = Math.max(currentAge, ageAtTenureEnd);

  if (!Number.isFinite(currentAge) || !Number.isFinite(ageAtTenureEnd)) {
    return {
      passed: false,
      code: 'MIN_AGE_BRE_FAILED',
      currentAge,
      ageAtTenureEnd,
      detail: `Age could not be computed: DOB=${dobIso}`,
    };
  }

  if (currentAge < input.minAge) {
    return {
      passed: false,
      code: 'MIN_AGE_BRE_FAILED',
      currentAge,
      ageAtTenureEnd,
      detail: `Min-age rule: currentAge=${currentAge}y, allowed=${input.minAge}-${input.maxAge - 1}y, DOB=${dobIso}`,
    };
  }

  if (oldestAge >= input.maxAge) {
    return {
      passed: false,
      code: 'MAX_AGE_BRE_FAILED',
      currentAge,
      ageAtTenureEnd,
      detail: `Max-age rule: ageAtTenureEnd=${ageAtTenureEnd}y on ${tenureEndIso}, max=${input.maxAge}y, currentAge=${currentAge}y, DOB=${dobIso}`,
    };
  }

  return { passed: true, currentAge, ageAtTenureEnd };
}
