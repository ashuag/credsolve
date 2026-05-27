export const LOAN_DOCUMENT_TYPE = {
  KEY_FACT: 'key-fact',
  LOAN_AGREEMENT: 'loan-agreement',
} as const;

export type LoanDocumentType = (typeof LOAN_DOCUMENT_TYPE)[keyof typeof LOAN_DOCUMENT_TYPE];

export const LOAN_DOCUMENT_TEMPLATE_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.docx',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.docx',
};

export const LOAN_DOCUMENT_PDF_FILES: Record<LoanDocumentType, string> = {
  [LOAN_DOCUMENT_TYPE.KEY_FACT]: 'key-fact-statement.pdf',
  [LOAN_DOCUMENT_TYPE.LOAN_AGREEMENT]: 'loan-agreement.pdf',
};
