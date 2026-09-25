import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { APPLICATION_STATUS } from '../../../common/constants/application.constants';
import { BUREAU_FETCHED } from '../../../common/constants/bureau-fetch.constants';
import { LEAD_STATUS } from '../../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../../common/constants/rejection-reason.constants';
import { isCibilVendorServiceName, isRecoverableBureauSoftPullRejection, LosCheckCibilService, wrapCibilHitJson } from './los-check-cibil.service';

describe('isRecoverableBureauSoftPullRejection', () => {
  it('matches the dedicated soft-pull rejection reason', () => {
    assert.equal(
      isRecoverableBureauSoftPullRejection({
        leadStatus: { name: LEAD_STATUS.REJECTED },
        rejectionReason: { name: REJECTION_REASON.BUREAU_SOFT_PULL_FAILED },
        leadStatusNote: null,
      }),
      true,
    );
  });

  it('matches legacy soft-pull notes that used REJECTED_BY_CLIENTS', () => {
    assert.equal(
      isRecoverableBureauSoftPullRejection({
        leadStatus: { name: LEAD_STATUS.REJECTED },
        rejectionReason: { name: REJECTION_REASON.REJECTED_BY_CLIENTS },
        leadStatusNote: 'Bureau soft-pull failed: credit bureau returned a non-success response.',
      }),
      true,
    );
  });

  it('ignores manual REJECTED_BY_CLIENTS without a soft-pull note', () => {
    assert.equal(
      isRecoverableBureauSoftPullRejection({
        leadStatus: { name: LEAD_STATUS.REJECTED },
        rejectionReason: { name: REJECTION_REASON.REJECTED_BY_CLIENTS },
        leadStatusNote: 'Ops decided not to proceed',
      }),
      false,
    );
  });
});

describe('isCibilVendorServiceName', () => {
  it('matches Tenacio, Surepass, and CIBIL07 CIBIL service names', () => {
    assert.equal(isCibilVendorServiceName('experian-soft-pull'), true);
    assert.equal(isCibilVendorServiceName('experian-soft-pull/services/experian-soft-pull'), true);
    assert.equal(isCibilVendorServiceName('credit-report-cibil'), true);
    assert.equal(isCibilVendorServiceName('cibil-soft-pull'), true);
  });

  it('ignores unrelated vendor calls on the same lead', () => {
    assert.equal(isCibilVendorServiceName('pan-name-dob'), false);
    assert.equal(isCibilVendorServiceName('digilocker-download-aadhaar'), false);
    assert.equal(isCibilVendorServiceName('sms-rejection'), false);
  });
});

describe('wrapCibilHitJson', () => {
  it('wraps CIBIL07 soft-pull bodies into the Tenacio envelope', () => {
    const wrapped = wrapCibilHitJson({
      providerName: 'CIBIL07',
      serviceName: 'cibil-soft-pull',
      httpStatus: 200,
      originalJson: { success: false, status: 'VENDOR_ERROR', error: { message: 'upstream timeout' } },
    });
    assert.equal((wrapped as { sourceVendor?: string }).sourceVendor, 'CIBIL07');
    assert.equal((wrapped as { status?: string }).status, 'error');
  });

  it('still wraps historical MyMoneyBazaar vendor-log bodies as CIBIL07', () => {
    const wrapped = wrapCibilHitJson({
      providerName: 'MyMoneyBazaar',
      serviceName: 'cibil-soft-pull',
      httpStatus: 200,
      originalJson: { success: false, status: 'VENDOR_ERROR', error: { message: 'upstream timeout' } },
    });
    assert.equal((wrapped as { sourceVendor?: string }).sourceVendor, 'CIBIL07');
  });

  it('leaves Tenacio bodies unchanged', () => {
    const original = { status: 'success', serviceStatusCode: 200, data: { cibilData: {} } };
    const wrapped = wrapCibilHitJson({
      providerName: 'Tenacio',
      serviceName: 'experian-soft-pull',
      httpStatus: 200,
      originalJson: original,
    });
    assert.equal(wrapped, original);
  });

  it('converts a truncated CIBIL07 vendor-log payload into a Tenacio success envelope', () => {
    const wrapped = wrapCibilHitJson({
      providerName: 'CIBIL07',
      serviceName: 'cibil-soft-pull',
      httpStatus: 200,
      originalJson: {
        parsed: {
          success: true,
          request_uuid: '96184dba-0daa-4a3e-b7f5-f9035cefb4c8',
          status: 'SUCCESS',
          http_status: 200,
          data: {
            data: {
              cibil: [{ score: '742', score_name: 'CIBILTransUnionScore3', cibil_date: '2026-09-17' }],
              loan_type: [
                {
                  name: 'personal_loan',
                  original_loan_type: 'Personal Loan',
                  member_name: 'SMICC',
                  opened_date: '2024-12-14',
                  overdue: 10429,
                  current_balance: 37324,
                  sanctioned: 190000,
                },
              ],
            },
          },
        },
        snippet: '{"success":true',
        _truncated: true,
        httpStatus: 200,
        _originalSize: 119075,
      },
    });
    const rec = wrapped as { status?: string; serviceStatusCode?: number; sourceVendor?: string };
    assert.equal(rec.sourceVendor, 'CIBIL07');
    assert.equal(rec.status, 'success');
    assert.equal(rec.serviceStatusCode, 200);
  });
});

describe('LosCheckCibilService', () => {
  const leadId = 11n;
  const customerId = 22n;
  const createdAt = new Date('2026-09-01T10:00:00.000Z');

  function buildService(overrides?: {
    vendorLogs?: Array<{
      id: bigint;
      uuid: string;
      providerName: string;
      serviceName: string;
      httpStatus: number | null;
      requestedAt: Date;
      responsePayload: unknown;
    }>;
    reports?: Array<{
      id: bigint;
      uuid: string;
      cibilScore: number | null;
      dummyFetched: boolean | null;
      serviceStatusCode: number | null;
      createdAt: Date;
    }>;
    fetchResult?: Record<string, unknown>;
    postBre?: { passed: boolean; rejectReason: string | null; rejectionReasonCode: string | null; cibilScore: number | null };
    leadStatusName?: string;
    leadStatusNote?: string | null;
    rejectionReasonName?: string | null;
    existingApplication?: {
      id: bigint;
      kyc: { kycStatus: number; kycCompletedAt: Date | null } | null;
      details: {
        selectedLoanAmount: number | null;
        emailVerifiedAt: Date | null;
        loanDocumentsAcceptedAt: Date | null;
        bankAccountNumber: string | null;
      } | null;
      _count: { references: number };
    } | null;
    onLeadUpdate?: (data: Record<string, unknown>) => void;
    onApplicationUpdate?: (data: Record<string, unknown>) => void;
  }) {
    const vendorLogs = overrides?.vendorLogs ?? [];
    const reports = overrides?.reports ?? [];
    let bureauFindManyCalled = false;
    let bureauFetchCalled = false;
    let postBreCalled = false;
    let leadUpdated = false;
    let rejectionSmsSent = false;

    const leadRow = {
      id: leadId,
      uuid: 'lead-uuid',
      customerId,
      createdAt,
      leadStatusNote: overrides?.leadStatusNote ?? null,
      customer: { uuid: 'cust-uuid', mobileNumber: '9876543210' },
      leadStatus: { name: overrides?.leadStatusName ?? LEAD_STATUS.NEW, displayName: 'New' },
      rejectionReason: overrides?.rejectionReasonName
        ? { name: overrides.rejectionReasonName }
        : null,
      leadDetail: {
        fullName: 'Test User',
        panNumber: 'ABCDE1234F',
        panVerified: 1,
        bureauFetched: BUREAU_FETCHED.NOT_FETCHED,
      },
    };

    const prisma = {
      read: {
        vendorApiLog: {
          findMany: async () => vendorLogs,
        },
        bureauReport: {
          findMany: async () => {
            bureauFindManyCalled = true;
            return reports;
          },
        },
        lead: {
          findUnique: async () => ({ id: leadId, customerId, createdAt }),
        },
        application: {
          findUnique: async () => null,
        },
      },
      client: {
        lead: {
          findUnique: async () => leadRow,
          update: async ({ data }: { data: Record<string, unknown> }) => {
            leadUpdated = true;
            overrides?.onLeadUpdate?.(data);
            return leadRow;
          },
        },
        leadDetail: {
          update: async () => ({}),
        },
        leadStatus: {
          findFirst: async ({ where }: { where: { name: string } }) => {
            if (where.name === LEAD_STATUS.REJECTED) return { id: 9 };
            if (where.name === LEAD_STATUS.CONVERTED) return { id: 5 };
            return { id: 3 };
          },
        },
        applicationStatus: {
          findFirst: async ({ where }: { where: { name: string } }) => {
            if (where.name === APPLICATION_STATUS.IN_REVIEW) return { id: 2 };
            if (where.name === APPLICATION_STATUS.DRAFT) return { id: 1 };
            if (where.name === APPLICATION_STATUS.REJECTED) return { id: 4 };
            return { id: 4 };
          },
        },
        rejectionReason: {
          findFirst: async () => ({ id: 7 }),
        },
        application: {
          findFirst: async () => overrides?.existingApplication ?? null,
          create: async () => ({ id: 50n }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            overrides?.onApplicationUpdate?.(data);
            return {};
          },
        },
        customer: {
          findUnique: async () => ({ mobileNumber: '9876543210' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma.client),
      },
    };

    const bureauFetch = {
      fetchBureauFromTenacio: async () => {
        bureauFetchCalled = true;
        return (
          overrides?.fetchResult ?? {
            configured: true,
            ok: true,
            httpStatus: 200,
            vendorBody: { status: 'success', serviceStatusCode: 200, data: { cibilData: { ok: true } } },
            dummyPayload: false,
            isNewToCredit: false,
            serviceErrorMessage: null,
          }
        );
      },
    };
    const bureauReports = {
      createFromVendorSnapshot: async () => ({ id: 1n, uuid: 'rep-1' }),
      findLatestRawPayloadForLead: async () => null,
    };
    const bureauReportPdf = { generateAndAttachForReport: async () => null };
    const cibilCreditAssessment = { runForLead: async () => null };
    const postBreCheck = {
      run: async () => {
        postBreCalled = true;
        return (
          overrides?.postBre ?? {
            passed: true,
            rejectReason: null,
            rejectionReasonCode: null,
            cibilScore: 742,
          }
        );
      },
    };
    const creditLimitTiers = { resolveMaxBulletLoan: async () => null };
    const sms = {
      sendRejectionSms: async () => {
        rejectionSmsSent = true;
      },
    };

    const service = new LosCheckCibilService(
      prisma as never,
      bureauFetch as never,
      bureauReports as never,
      bureauReportPdf as never,
      cibilCreditAssessment as never,
      postBreCheck as never,
      creditLimitTiers as never,
      sms as never,
    );

    return {
      service,
      flags: {
        get bureauFindManyCalled() {
          return bureauFindManyCalled;
        },
        get bureauFetchCalled() {
          return bureauFetchCalled;
        },
        get postBreCalled() {
          return postBreCalled;
        },
        get leadUpdated() {
          return leadUpdated;
        },
        get rejectionSmsSent() {
          return rejectionSmsSent;
        },
      },
    };
  }

  it('lists vendor CIBIL logs for the lead when present', async () => {
    const { service, flags } = buildService({
      vendorLogs: [
        {
          id: 1n,
          uuid: 'log-1',
          providerName: 'Tenacio',
          serviceName: 'experian-soft-pull',
          httpStatus: 200,
          requestedAt: new Date('2026-09-12T06:00:00.000Z'),
          responsePayload: { status: 'success' },
        },
        {
          id: 2n,
          uuid: 'log-2',
          providerName: 'Tenacio',
          serviceName: 'pan-name-dob',
          httpStatus: 200,
          requestedAt: new Date('2026-09-12T05:00:00.000Z'),
          responsePayload: { status: 'success' },
        },
      ],
    });

    const hits = await service.listHitsForLead(leadId, customerId, createdAt);
    assert.equal(hits.hitCount, 1);
    assert.equal(hits.hits[0]?.vendorLogUuid, 'log-1');
    assert.deepEqual(hits.hits[0]?.originalJson, { status: 'success' });
    assert.deepEqual(hits.hits[0]?.wrappedJson, { status: 'success' });
    assert.equal(flags.bureauFindManyCalled, false);
  });

  it('unwraps truncated vendor-log JSON and converts it to Tenacio', async () => {
    const parsed = {
      success: true,
      request_uuid: 'req-1',
      status: 'SUCCESS',
      http_status: 200,
      data: {
        data: {
          cibil: [{ score: '742', score_name: 'CIBILTransUnionScore3', cibil_date: '2026-09-17' }],
          loan_type: [
            {
              name: 'personal_loan',
              original_loan_type: 'Personal Loan',
              member_name: 'SMICC',
              opened_date: '2024-12-14',
              overdue: 10429,
              current_balance: 37324,
              sanctioned: 190000,
            },
          ],
        },
      },
    };
    const { service } = buildService({
      vendorLogs: [
        {
          id: 1n,
          uuid: 'log-cibil07',
          providerName: 'CIBIL07',
          serviceName: 'cibil-soft-pull',
          httpStatus: 200,
          requestedAt: new Date('2026-09-17T10:00:00.000Z'),
          responsePayload: {
            parsed,
            snippet: '{"success":true',
            _truncated: true,
            httpStatus: 200,
            _originalSize: 119075,
          },
        },
      ],
    });

    const hits = await service.listHitsForLead(leadId, customerId, createdAt);
    assert.deepEqual(hits.hits[0]?.originalJson, parsed);
    const wrapped = hits.hits[0]?.wrappedJson as { status?: string; serviceStatusCode?: number };
    assert.equal(wrapped.status, 'success');
    assert.equal(wrapped.serviceStatusCode, 200);
  });

  it('falls back to stored bureau reports when the lead has no vendor CIBIL logs', async () => {
    const { service } = buildService({
      reports: [
        {
          id: 1n,
          uuid: 'rep-a',
          cibilScore: 710,
          dummyFetched: true,
          serviceStatusCode: 200,
          createdAt: new Date('2026-09-12T06:10:00.000Z'),
        },
        {
          id: 2n,
          uuid: 'rep-b',
          cibilScore: 705,
          dummyFetched: true,
          serviceStatusCode: 200,
          createdAt: new Date('2026-09-12T06:00:00.000Z'),
        },
      ],
    });

    const hits = await service.listHitsForLead(leadId, customerId, createdAt);
    assert.equal(hits.hitCount, 2);
    assert.deepEqual(hits.hits.map((h) => h.bureauReportUuid), ['rep-a', 'rep-b']);
  });

  it('rejects a blacklisted lead before calling the bureau', async () => {
    const { service, flags } = buildService({ leadStatusName: LEAD_STATUS.BLACKLISTED });
    await assert.rejects(() => service.checkForLead('lead-uuid'), BadRequestException);
    assert.equal(flags.bureauFetchCalled, false);
  });

  it('rejects the lead when post-BRE fails after a successful CIBIL fetch', async () => {
    const { service, flags } = buildService({
      postBre: {
        passed: false,
        rejectReason: 'CIBIL score 600 is below minimum 700 for new customers.',
        rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
        cibilScore: 600,
      },
    });

    const result = await service.checkForLead('lead-uuid');
    assert.equal(flags.postBreCalled, true);
    assert.equal(result.rejected, true);
    assert.equal(result.outcome, 'post_bre_failed');
    assert.equal(result.postBre?.rejectionReasonCode, REJECTION_REASON.CIBIL_SCORE_LOW);
    assert.equal(flags.leadUpdated, true);
    assert.equal(flags.rejectionSmsSent, true);
  });

  it('restores a soft-pull-rejected lead to IN_REVIEW when the journey is already complete', async () => {
    const leadUpdates: Array<Record<string, unknown>> = [];
    const appUpdates: Array<Record<string, unknown>> = [];

    const { service, flags } = buildService({
      leadStatusName: LEAD_STATUS.REJECTED,
      leadStatusNote: 'Bureau soft-pull failed: credit bureau returned a non-success response.',
      rejectionReasonName: REJECTION_REASON.BUREAU_SOFT_PULL_FAILED,
      existingApplication: {
        id: 88n,
        kyc: { kycStatus: 1, kycCompletedAt: new Date('2026-08-20T10:00:00.000Z') },
        details: {
          selectedLoanAmount: 30000,
          emailVerifiedAt: new Date('2026-08-20T10:00:00.000Z'),
          loanDocumentsAcceptedAt: new Date('2026-08-21T10:00:00.000Z'),
          bankAccountNumber: '1234567890',
        },
        _count: { references: 2 },
      },
      onLeadUpdate: (data) => leadUpdates.push(data),
      onApplicationUpdate: (data) => appUpdates.push(data),
    });

    const result = await service.checkForLead('lead-uuid');
    assert.equal(flags.postBreCalled, true);
    assert.equal(result.rejected, false);
    assert.equal(result.outcome, 'fetched_and_passed');
    assert.match(result.message, /IN_REVIEW/);
    assert.equal(leadUpdates.some((u) => u.rejectionReasonId === null), true);
    assert.equal(appUpdates.some((u) => u.applicationStatusId === 2), true);
  });
});
