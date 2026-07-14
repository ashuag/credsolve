/** NBFC entity details — used in sanction letter (Key Fact Statement) header. */
export const NBFC_NAME = 'CREDSOLVE TECHNOLOGIES PRIVATE LIMITED';
export const NBFC_ADDRESS =
  'Flat No.: E-2748, Gaur Siddhartham, Siddharth Vihar, Ghaziabad, Uttar Pradesh-201009';
export const NBFC_EMAIL = 'info@moneycash.in';
export const NBFC_LOGO_FILE = 'moneycash-logo.png';

/** Lender / LSP details per RBI Digital Lending Guidelines — Sanction Letter KFS fields. */
export const LENDER_NAME = 'Aasra Fincorp Pvt. Ltd.';
export const LENDER_LOGO_FILE = 'asra-fincorp-logo.png';
export const LSP_NAME = 'CREDSOLVE TECHNOLOGIES PRIVATE LIMITED';
export const DLA_NAME = 'NA';
export const RECOVERY_AGENT_NAME = 'CREDSOLVE TECHNOLOGIES PRIVATE LIMITED';
export const PAYABLE_TO = 'Aasra Fincorp Pvt. Ltd.';

/** Grievance / nodal contacts shown on KFS (LSP = NBFC, RE = Lender). */
export const LSP_GRO_NAME = 'CREDSOLVE TECHNOLOGIES PRIVATE LIMITED — Grievance Officer';
export const LSP_GRO_PHONE = '+91-120-0000000';
export const LSP_NODAL_NAME = 'CREDSOLVE TECHNOLOGIES PRIVATE LIMITED — Nodal Officer';
export const LSP_NODAL_PHONE = '+91-120-0000000';
export const LENDER_GRO_NAME = 'Aasra Fincorp Pvt. Ltd. — Grievance Officer';
export const LENDER_GRO_PHONE = '+91-11-00000000';
export const LENDER_NODAL_NAME = 'Aasra Fincorp Pvt. Ltd. — Nodal Officer';
export const LENDER_NODAL_PHONE = '+91-11-00000000';
export const LENDER_REGISTERED_OFFICE =
  'Registered office of Aasra Fincorp Pvt. Ltd. (as per MCA records)';

/** PKCS#7 / Adobe signature panel metadata for the NBFC (RE) digital signature. */
export const LENDER_SIGNING_NAME = LENDER_NAME;
export const LENDER_SIGNING_LOCATION = 'New Delhi, IN';
export const LENDER_SIGNING_CONTACT = NBFC_EMAIL;
export const LOAN_DOCUMENT_SIGNING_REASON = 'Loan Sanction Letter cum Key Fact Statement';

/** Stored acceptance label shown in LOS when loan documents are OTP-accepted. */
export const LOAN_DOCUMENT_ACCEPTANCE_NAME = 'Loan Sanction letter cum Key Fact Statement';

/** Default placeholder size for PKCS#7 signature (hex chars in /Contents). */
export const LOAN_DOCUMENT_SIGNATURE_PLACEHOLDER_LENGTH = 8192;

/** Default penal charge parameters (sanction letter section A). */
export const DEFAULT_PENAL_RATE_PERCENT = '10%';
export const DEFAULT_PENAL_MIN_INR = '100';
export const DEFAULT_PENAL_MAX_INR = '3,000';
export const DEFAULT_MAX_MONTHLY_RATE_PERCENT = '30';

export const LOAN_DOCUMENT_HTML_TEMPLATE = 'MoneyCash_Loan_Document.html';

export const LOAN_DOCUMENT_TYPE = {
  KEY_FACT: 'key-fact',
  LOAN_AGREEMENT: 'loan-agreement',
} as const;

export type LoanDocumentType = (typeof LOAN_DOCUMENT_TYPE)[keyof typeof LOAN_DOCUMENT_TYPE];

/** Source Word files (dev-only; see assets/loan-documents/README.md). */
export const LOAN_DOCUMENT_TEMPLATE_DOCX_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.docx',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.docx',
};

export const LOAN_DOCUMENT_TEMPLATE_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.template.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.template.pdf',
};

export const LOAN_DOCUMENT_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.pdf',
};
