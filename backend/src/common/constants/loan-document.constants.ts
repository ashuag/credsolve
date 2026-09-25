/** NBFC entity details — used in sanction letter (Key Fact Statement) header. */
export const NBFC_NAME = 'MoneyCash';
export const NBFC_ADDRESS =
  'Flat No.: E-2748, Gaur Siddhartham, Siddharth Vihar, Ghaziabad, Uttar Pradesh-201009';
export const NBFC_EMAIL = 'info@moneycash.in';
export const NBFC_LOGO_FILE = 'moneycash-logo.png';

/** Lender / LSP details per RBI Digital Lending Guidelines — Sanction Letter KFS fields. */
export const LENDER_NAME = 'Aasra Fincorp Pvt. Ltd.';
export const LENDER_LOGO_FILE = 'asra-fincorp-logo.png';
export const LSP_NAME = 'MoneyCash';
export const DLA_NAME = 'MoneyCash (moneycash.in)';
export const RECOVERY_AGENT_NAME = 'MoneyCash';
export const PAYABLE_TO = 'Aasra Fincorp Pvt. Ltd.';

/** Grievance / nodal contacts shown on KFS (LSP = NBFC/MoneyCash, RE = Lender). */
export const LSP_GRO_NAME = 'Mohammad Uvaid';
export const LSP_GRO_PHONE = '+91-8826370278';
export const LSP_GRO_EMAIL = 'uvaid@moneycash.in';
export const LSP_NODAL_NAME = 'Mohammad Uvaid';
export const LSP_NODAL_PHONE = '+91-8826370278';
export const LSP_NODAL_EMAIL = 'uvaid@moneycash.in';
export const LENDER_GRO_NAME = 'Subash Patel';
export const LENDER_GRO_PHONE = '+91-7318066022';
export const LENDER_GRO_EMAIL = 'grievance.nodal@aasrafincorp.com';
export const LENDER_NODAL_NAME = 'Subash Patel';
export const LENDER_NODAL_PHONE = '+91-7318066022';
export const LENDER_NODAL_EMAIL = 'grievance.nodal@aasrafincorp.com';
export const LENDER_REGISTERED_OFFICE =
  '16/3/8B A N Jha Marg George Town Prayagraj-211002 U.P';

/** PKCS#7 / Adobe signature panel metadata for the NBFC (RE) digital signature. */
export const LENDER_SIGNING_NAME = LENDER_NAME;
export const LENDER_SIGNING_LOCATION = 'New Delhi, IN';
export const LENDER_SIGNING_CONTACT = NBFC_EMAIL;
export const LOAN_DOCUMENT_SIGNING_REASON = 'Loan Sanction Letter cum Key Fact Statement';

/** Stored acceptance label shown in LOS when loan documents are OTP-accepted. */
export const LOAN_DOCUMENT_ACCEPTANCE_NAME = 'Loan Sanction letter cum Key Fact Statement';

/** Default placeholder size for PKCS#7 signature (hex chars in /Contents). */
export const LOAN_DOCUMENT_SIGNATURE_PLACEHOLDER_LENGTH = 8192;

export const LOAN_DOCUMENT_HTML_TEMPLATE = 'MoneyCash_Loan_Document.html';

export const LOAN_DOCUMENT_TYPE = {
  KEY_FACT: 'key-fact',
  /** Revised sanction letter + commercial terms generated at disbursement (separate from customer acceptance copy). */
  KEY_FACT_DISBURSEMENT: 'key-fact-disbursement',
  LOAN_AGREEMENT: 'loan-agreement',
} as const;

export type LoanDocumentType = (typeof LOAN_DOCUMENT_TYPE)[keyof typeof LOAN_DOCUMENT_TYPE];

/** Source Word files (dev-only; see assets/loan-documents/README.md). */
export const LOAN_DOCUMENT_TEMPLATE_DOCX_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.docx',
  [LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT]: 'key-fact-statement.docx',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.docx',
};

export const LOAN_DOCUMENT_TEMPLATE_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.template.pdf',
  [LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT]: 'key-fact-statement.template.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.template.pdf',
};

export const LOAN_DOCUMENT_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.pdf',
  [LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT]: 'key-fact-statement-disbursement.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.pdf',
};

/** Loan cum Commercial Terms — emailed alongside the post-acceptance sanction letter only. At disbursement it is merged into the KFS PDF. */
export const LOAN_COMMERCIAL_TERMS_PDF_FILENAME = 'loan-cum-commercial-terms.pdf';
