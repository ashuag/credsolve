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
 * Reuse the customer's latest `bureau_report` when that snapshot is a successful
 * payload still inside the days limit (repaid recurring *or* rejected reapply).
 * Reuse attaches `lead_detail.bureau_report_id` to the existing row (no clone).
 * Post-BRE still runs against the attached payload.
 */
export function canReusePriorBureauReport(params: {
  daysLimit: number;
  priorCreatedAt: Date | null | undefined;
  priorPayload: unknown;
  now?: Date;
}): boolean {
  if (params.priorCreatedAt == null || params.priorPayload == null) return false;
  if (!isTenacioBureauSuccessPayload(params.priorPayload)) return false;
  return isBureauReportWithinDaysLimit(params.priorCreatedAt, params.daysLimit, params.now);
}
