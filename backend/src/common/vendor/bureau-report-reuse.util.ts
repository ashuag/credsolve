import { isTenacioBureauSuccessPayload } from './tenacio-bureau-payload.mapper';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Rolling window: a report created `daysLimit` days ago is stale and must be refetched. */
export function isBureauReportWithinDaysLimit(
  createdAt: Date,
  daysLimit: number,
  now: Date = new Date(),
): boolean {
  if (daysLimit <= 0) return false;
  const ageMs = now.getTime() - createdAt.getTime();
  if (ageMs < 0) return true;
  return ageMs < daysLimit * MS_PER_DAY;
}

/**
 * Recurring (repaid/CLOSED) customers reuse the latest `bureau_report` for this
 * customer when that snapshot is a successful payload still inside the days limit.
 * Reuse attaches `lead_detail.bureau_report_id` to the existing row (no clone).
 */
export function canReusePriorBureauReport(params: {
  isRecurring: boolean;
  daysLimit: number;
  priorCreatedAt: Date | null | undefined;
  priorPayload: unknown;
  now?: Date;
}): boolean {
  if (!params.isRecurring) return false;
  if (params.priorCreatedAt == null || params.priorPayload == null) return false;
  if (!isTenacioBureauSuccessPayload(params.priorPayload)) return false;
  return isBureauReportWithinDaysLimit(params.priorCreatedAt, params.daysLimit, params.now);
}
