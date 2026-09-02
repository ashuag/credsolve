import {
  defaultMonthEndDueDateUtc,
  lastDayOfMonthUtc,
  overlayLiveRepaymentDueDateIfSelected,
  parseIsoDateUtc,
  resolveRepaymentDueDateUtc,
  syncExpectedRepaymentDateUntilDisbursed,
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

  it('overlays the live due date onto a pre-disbursement snapshot', () => {
    const overlaid = overlayLiveRepaymentDueDateIfSelected(
      {
        expectedRepaymentDate: new Date('2026-09-10T00:00:00.000Z'),
        expectedRepaymentDays: 10,
        selectedLoanAmount: 5000,
      },
      new Date('2026-09-15T00:00:00.000Z'),
      new Date('2026-09-05T10:00:00+05:30'),
    );
    expect(overlaid?.expectedRepaymentDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(overlaid?.expectedRepaymentDays).toBe(11);
    expect(overlaid?.selectedLoanAmount).toBe(5000);
  });

  it('does not overlay when there is no stored selection date', () => {
    expect(
      overlayLiveRepaymentDueDateIfSelected(
        { expectedRepaymentDate: null, expectedRepaymentDays: null },
        new Date('2026-09-15T00:00:00.000Z'),
      ),
    ).toEqual({ expectedRepaymentDate: null, expectedRepaymentDays: null });
  });
});

describe('syncExpectedRepaymentDateUntilDisbursed', () => {
  function prismaWithOverride(dueDate: Date | null) {
    return {
      repaymentDueDate: {
        findFirst: jest.fn(async () => (dueDate ? { dueDate } : null)),
      },
      applicationDetail: {
        update: jest.fn(async () => ({})),
      },
    };
  }

  it('persists a new due date when the LOS override changes before disbursement', async () => {
    const prisma = prismaWithOverride(new Date('2026-09-15T00:00:00.000Z'));
    const result = await syncExpectedRepaymentDateUntilDisbursed(prisma, {
      applicationId: 41n,
      storedDate: new Date('2026-09-10T00:00:00.000Z'),
      storedDays: 10,
      disbursed: false,
      asOf: new Date('2026-09-05T10:00:00+05:30'),
    });

    expect(result.changed).toBe(true);
    expect(result.expectedRepaymentDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(result.expectedRepaymentDays).toBe(11);
    expect(prisma.applicationDetail.update).toHaveBeenCalledWith({
      where: { applicationId: 41n },
      data: {
        expectedRepaymentDate: result.expectedRepaymentDate,
        expectedRepaymentDays: 11,
      },
    });
  });

  it('clears unsigned documents when the due date changes', async () => {
    const prisma = prismaWithOverride(new Date('2026-09-15T00:00:00.000Z'));
    await syncExpectedRepaymentDateUntilDisbursed(prisma, {
      applicationId: 41n,
      storedDate: new Date('2026-09-10T00:00:00.000Z'),
      storedDays: 10,
      disbursed: false,
      invalidateUnsignedDocuments: true,
      asOf: new Date('2026-09-05T10:00:00+05:30'),
    });

    expect(prisma.applicationDetail.update).toHaveBeenCalledWith({
      where: { applicationId: 41n },
      data: {
        expectedRepaymentDate: expect.any(Date),
        expectedRepaymentDays: 11,
        keyFactPdfRelativePath: null,
        loanAgreementPdfRelativePath: null,
        keyFactEsigned: false,
        loanDocumentsReviewedAt: null,
        loanDocumentsReviewedIp: null,
      },
    });
  });

  it('does not write when the live date already matches the stored snapshot', async () => {
    const prisma = prismaWithOverride(new Date('2026-09-10T00:00:00.000Z'));
    const result = await syncExpectedRepaymentDateUntilDisbursed(prisma, {
      applicationId: 41n,
      storedDate: new Date('2026-09-10T00:00:00.000Z'),
      storedDays: 6,
      disbursed: false,
      asOf: new Date('2026-09-05T10:00:00+05:30'),
    });

    expect(result.changed).toBe(false);
    expect(result.expectedRepaymentDate?.toISOString().slice(0, 10)).toBe('2026-09-10');
    expect(prisma.applicationDetail.update).not.toHaveBeenCalled();
  });

  it('leaves the stored date frozen after disbursement', async () => {
    const prisma = prismaWithOverride(new Date('2026-09-30T00:00:00.000Z'));
    const result = await syncExpectedRepaymentDateUntilDisbursed(prisma, {
      applicationId: 41n,
      storedDate: new Date('2026-09-10T00:00:00.000Z'),
      storedDays: 10,
      disbursed: true,
      asOf: new Date('2026-09-20T10:00:00+05:30'),
    });

    expect(result).toEqual({
      expectedRepaymentDate: new Date('2026-09-10T00:00:00.000Z'),
      expectedRepaymentDays: 10,
      changed: false,
    });
    expect(prisma.applicationDetail.update).not.toHaveBeenCalled();
    expect(prisma.repaymentDueDate.findFirst).not.toHaveBeenCalled();
  });
});
