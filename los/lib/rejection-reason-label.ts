/** Human-readable LOS labels for `rejection_reason.name` codes. */
const REJECTION_REASON_LABEL: Record<string, string> = {
  REJECTED_BY_CLIENTS: 'Rejected by clients',
  BUREAU_SOFT_PULL_FAILED: 'Bureau soft-pull failed',
  PENNYDROP_FAILED: 'Penny drop failed',
  BANK_NAME_MISMATCH: 'Bank account name mismatch',
  KYC_FAILED: 'KYC failed',
  OVERDUE_AMOUNT: 'Overdue amount',
};

export function rejectionReasonDisplayLabel(name: string): string {
  return REJECTION_REASON_LABEL[name] ?? name.replace(/_/g, ' ');
}
