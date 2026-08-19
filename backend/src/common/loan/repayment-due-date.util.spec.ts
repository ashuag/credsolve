import {
  defaultMonthEndDueDateUtc,
  lastDayOfMonthUtc,
  parseIsoDateUtc,
  resolveRepaymentDueDateUtc,
} from './repayment-due-date.util';

describe('repayment-due-date.util', () => {
  it('returns last day of the current month for IST days 1–15', () => {
    expect(defaultMonthEndDueDateUtc(new Date('2026-08-05T00:00:00.000Z')).toISOString().slice(0, 10)).toBe(
      '2026-08-31',
    );
    expect(defaultMonthEndDueDateUtc(new Date('2026-08-15T00:00:00.000Z')).toISOString().slice(0, 10)).toBe(
      '2026-08-31',
    );
  });

  it('returns last day of the next month for IST days 16+', () => {
    expect(defaultMonthEndDueDateUtc(new Date('2026-08-16T00:00:00.000Z')).toISOString().slice(0, 10)).toBe(
      '2026-09-30',
    );
    expect(defaultMonthEndDueDateUtc(new Date('2026-12-20T00:00:00.000Z')).toISOString().slice(0, 10)).toBe(
      '2027-01-31',
    );
  });

  it('computes last calendar day of a month', () => {
    expect(lastDayOfMonthUtc(2026, 8).toISOString().slice(0, 10)).toBe('2026-08-31');
    expect(lastDayOfMonthUtc(2026, 2).toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('rejects invalid ISO dates', () => {
    expect(parseIsoDateUtc('2026-08-32')).toBeNull();
    expect(parseIsoDateUtc('Aug 29')).toBeNull();
  });

  it('applies an active override for the computed due month', async () => {
    const prisma = {
      repaymentDueDate: {
        findFirst: jest.fn(async ({ where }: { where: { year: number; month: number } }) => {
          if (where.year === 2026 && where.month === 8) {
            return { dueDate: new Date('2026-08-29T00:00:00.000Z') };
          }
          return null;
        }),
      },
    };

    const midMonth = await resolveRepaymentDueDateUtc(prisma, new Date('2026-08-05T10:00:00+05:30'));
    expect(midMonth.toISOString().slice(0, 10)).toBe('2026-08-29');

    const afterCutoffStillInMonth = await resolveRepaymentDueDateUtc(
      prisma,
      new Date('2026-08-16T10:00:00+05:30'),
    );
    expect(afterCutoffStillInMonth.toISOString().slice(0, 10)).toBe('2026-08-29');

    const afterOverrideDate = await resolveRepaymentDueDateUtc(
      prisma,
      new Date('2026-08-30T10:00:00+05:30'),
    );
    expect(afterOverrideDate.toISOString().slice(0, 10)).toBe('2026-09-30');

    const priorMonth = await resolveRepaymentDueDateUtc(prisma, new Date('2026-07-20T10:00:00+05:30'));
    expect(priorMonth.toISOString().slice(0, 10)).toBe('2026-08-29');
  });

  it('uses a current-month override whose due date falls in a later month', async () => {
    const prisma = {
      repaymentDueDate: {
        findFirst: jest.fn(async ({ where }: { where: { year: number; month: number } }) => {
          if (where.year === 2026 && where.month === 8) {
            return { dueDate: new Date('2026-09-10T00:00:00.000Z') };
          }
          return null;
        }),
      },
    };

    const restOfAugust = await resolveRepaymentDueDateUtc(
      prisma,
      new Date('2026-08-20T10:00:00+05:30'),
    );
    expect(restOfAugust.toISOString().slice(0, 10)).toBe('2026-09-10');
  });
});
