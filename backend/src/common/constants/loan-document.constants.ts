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

/** Pre-built PDF shells filled at runtime via pdf-lib (see `*.fields.json`). */
export const LOAN_DOCUMENT_TEMPLATE_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.template.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.template.pdf',
};

export const LOAN_DOCUMENT_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.pdf',
};
