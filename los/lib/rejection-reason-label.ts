/** Human-readable LOS labels for `rejection_reason.name` codes. */
const REJECTION_REASON_LABEL: Record<string, string> = {
  PENNYDROP_FAILED: 'Penny drop failed',
  KYC_FAILED: 'KYC failed',
};

export function rejectionReasonDisplayLabel(name: string): string {
  return REJECTION_REASON_LABEL[name] ?? name.replace(/_/g, ' ');
}
