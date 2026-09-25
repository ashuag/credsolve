import { authorizedLosRequest } from './_shared';

export type LosCibilHitLog = {
  id: string;
  kind: 'vendor' | 'report';
  at: string;
  providerName: string | null;
  serviceName: string | null;
  httpStatus: number | null;
  outcome: 'success' | 'failure';
  dummyFetched: boolean;
  vendorLogUuid: string | null;
  bureauReportUuid: string | null;
  originalJson: unknown | null;
  /** Vendor payload converted to a Tenacio-style bureau response JSON. */
  wrappedJson: unknown | null;
};

export type LosCibilHitsPayload = {
  hitCount: number;
  hits: LosCibilHitLog[];
};

export type LosCheckCibilOutcome =
  | 'fetched_and_passed'
  | 'post_bre_failed'
  | 'ntc'
  | 'bureau_identity_failed'
  | 'bureau_failed'
  | 'not_configured';

export type LosCheckCibilResult = LosCibilHitsPayload & {
  ok: boolean;
  rejected: boolean;
  outcome: LosCheckCibilOutcome;
  message: string;
  cibilScore: number | null;
  bureauFetched: number;
  leadStatusCode: string;
  leadStatusLabel: string;
  rejectionReason: { code: string; label: string } | null;
  postBre: {
    passed: boolean;
    rejectReason: string | null;
    rejectionReasonCode: string | null;
  } | null;
};

const CHECK_CIBIL_TIMEOUT_MS = 90_000;

export async function getLeadCibilHits(token: string, leadUuid: string): Promise<LosCibilHitsPayload> {
  return authorizedLosRequest<LosCibilHitsPayload>(
    token,
    `/leads/${encodeURIComponent(leadUuid)}/cibil-hits`,
    { method: 'GET', cache: 'no-store' },
    'Failed to load CIBIL hit logs.',
  );
}

export async function getApplicationCibilHits(
  token: string,
  applicationUuid: string,
): Promise<LosCibilHitsPayload> {
  return authorizedLosRequest<LosCibilHitsPayload>(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/cibil-hits`,
    { method: 'GET', cache: 'no-store' },
    'Failed to load CIBIL hit logs.',
  );
}

export async function checkLeadCibilScore(token: string, leadUuid: string): Promise<LosCheckCibilResult> {
  return authorizedLosRequest<LosCheckCibilResult>(
    token,
    `/leads/${encodeURIComponent(leadUuid)}/check-cibil`,
    { method: 'POST' },
    'Failed to check CIBIL score.',
    CHECK_CIBIL_TIMEOUT_MS,
  );
}

export async function checkApplicationCibilScore(
  token: string,
  applicationUuid: string,
): Promise<LosCheckCibilResult> {
  return authorizedLosRequest<LosCheckCibilResult>(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/check-cibil`,
    { method: 'POST' },
    'Failed to check CIBIL score.',
    CHECK_CIBIL_TIMEOUT_MS,
  );
}
