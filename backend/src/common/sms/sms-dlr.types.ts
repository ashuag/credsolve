/**
 * Cerf / SmsGateway delivery-report (DLR) webhook body.
 * Configure the gateway callback URL to: POST /api/webhooks/sms/dlr
 */
export type SmsDlrWebhookPayload = {
  message_id?: string | null;
  service?: string | null;
  sender?: string | null;
  mobile?: string | null;
  status?: string | null;
  code?: string | null;
  submit_at?: string | null;
  dlr_received_at?: string | null;
  entity_id?: string | null;
  template_id?: string | null;
  units?: string | number | null;
  /** Set on send to `otp_request.uuid` so DLR can be matched back. */
  correlation_id?: string | null;
};

export const SMS_DLR_STATUS = {
  DELIVERED: 'DELIVRD',
  UNDELIVERED: 'UNDELIV',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTD',
  ACCEPTED: 'ACCEPTD',
} as const;

export function isSmsDeliveredStatus(status: string | null | undefined): boolean {
  const normalized = status?.trim().toUpperCase();
  return normalized === SMS_DLR_STATUS.DELIVERED || normalized === 'DELIVERED';
}
