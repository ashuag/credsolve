import type { LosApplicationDetails } from '@/lib/api';
import { buildWorkspaceAlertText, isWorkspaceRecordRejected } from '@/lib/workspace-alert';

export function isApplicationRecordRejected(row: LosApplicationDetails): boolean {
  return (
    isWorkspaceRecordRejected(row.statusCode) ||
    isWorkspaceRecordRejected(row.lead.statusCode, row.lead.rejectionReason?.label) ||
    row.statusCode.toUpperCase() === 'KYC_FAILED'
  );
}

export function applicationRejectionHeadline(row: LosApplicationDetails): string {
  if (row.lead.statusCode.toUpperCase().includes('REJECT')) return row.lead.statusLabel;
  if (row.statusCode.toUpperCase().includes('REJECT')) return row.statusLabel;
  if (row.statusCode.toUpperCase() === 'KYC_FAILED') return row.kycStatusLabel;
  return 'Rejected';
}

/** Human-readable rejection / failure context for the application workspace banner. */
export function buildApplicationWorkspaceAlertText(row: LosApplicationDetails): string | null {
  if (row.lead.statusCode.toUpperCase().includes('REJECT')) {
    return buildWorkspaceAlertText({
      statusCode: row.lead.statusCode,
      rejectionReason: row.lead.rejectionReason?.label,
      leadStatusNote: row.lead.leadStatusNote,
      bureauFetchedNote: row.lead.bureauFetchedNote,
      panVerified: row.lead.panVerified,
      bureauFetched: row.lead.bureauFetched,
    });
  }

  if (row.statusCode.toUpperCase().includes('REJECT')) {
    return buildWorkspaceAlertText({ statusCode: row.statusCode });
  }

  if (row.statusCode.toUpperCase() === 'KYC_FAILED') {
    return row.kycStatusLabel || 'KYC verification failed.';
  }

  return null;
}
