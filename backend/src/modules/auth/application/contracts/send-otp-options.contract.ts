export type SendOtpOptions = {
  /** DLT template id (defaults to login OTP). */
  smsTemplateId?: string;
  leadId?: bigint | null;
};
