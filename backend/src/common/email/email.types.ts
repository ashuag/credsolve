export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendEmailAuditContext = {
  serviceName: string;
  leadId?: bigint | null;
};

export type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  audit?: SendEmailAuditContext;
};
