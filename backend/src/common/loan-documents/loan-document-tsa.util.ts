import { Logger } from '@nestjs/common';
import { timestampPdf } from 'pdf-rfc3161';
import {
  LENDER_SIGNING_CONTACT,
  LENDER_SIGNING_LOCATION,
  LENDER_SIGNING_NAME,
} from '../constants/loan-document.constants';

const logger = new Logger('LoanDocumentTsa');

export type LoanDocumentTsaOptions = {
  url: string;
  enableLtv?: boolean;
  timeoutMs?: number;
};

/**
 * Adds an RFC-3161 document timestamp (DocTimeStamp) from a trusted TSA.
 * Runs after the NBFC PKCS#7 signature so Adobe shows independent TSA proof of signing time.
 */
export async function applyRfc3161DocumentTimestamp(
  signedPdf: Buffer,
  options: LoanDocumentTsaOptions,
): Promise<Buffer> {
  const result = await timestampPdf({
    pdf: new Uint8Array(signedPdf),
    tsa: {
      url: options.url,
      timeout: options.timeoutMs ?? 30_000,
    },
    enableLTV: options.enableLtv ?? false,
    reason: 'Loan document execution timestamp',
    location: LENDER_SIGNING_LOCATION,
    contactInfo: LENDER_SIGNING_CONTACT,
    signatureFieldName: 'TSA Timestamp',
  });

  logger.log(
    `[E-SIGN] RFC-3161 TSA timestamp applied (${options.url}); genTime=${result.timestamp.genTime.toISOString()}`,
  );
  return Buffer.from(result.pdf);
}

export function readLoanDocumentTsaOptionsFromEnv(env: NodeJS.ProcessEnv): LoanDocumentTsaOptions | null {
  const url = env.LOAN_DOCUMENT_TSA_URL?.trim();
  if (!url) return null;

  const enableLtv = env.LOAN_DOCUMENT_TSA_LTV?.trim().toLowerCase() === 'true';
  const timeoutRaw = env.LOAN_DOCUMENT_TSA_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : undefined;

  return {
    url,
    enableLtv,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
  };
}
