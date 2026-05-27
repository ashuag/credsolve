-- Pre-KYC loan documents (Key Fact Statement + Loan Agreement) stored under storage/customer/…
ALTER TABLE `application`
  ADD COLUMN `key_fact_pdf_relative_path` VARCHAR(512) NULL AFTER `liveness_passed`,
  ADD COLUMN `loan_agreement_pdf_relative_path` VARCHAR(512) NULL AFTER `key_fact_pdf_relative_path`,
  ADD COLUMN `loan_documents_accepted_at` DATETIME NULL AFTER `loan_agreement_pdf_relative_path`;
