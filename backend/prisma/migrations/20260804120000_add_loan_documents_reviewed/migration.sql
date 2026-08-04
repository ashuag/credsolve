-- Reviewed (checkbox agree on /loan-documents) is separate from OTP acceptance after references.
ALTER TABLE `application_detail`
  ADD COLUMN `loan_documents_reviewed_at` DATETIME(3) NULL AFTER `loan_documents_accepted_ip`,
  ADD COLUMN `loan_documents_reviewed_ip` VARCHAR(45) NULL AFTER `loan_documents_reviewed_at`;

-- Existing OTP-accepted applications already passed the review step.
UPDATE `application_detail`
SET
  `loan_documents_reviewed_at` = `loan_documents_accepted_at`,
  `loan_documents_reviewed_ip` = `loan_documents_accepted_ip`
WHERE `loan_documents_accepted_at` IS NOT NULL
  AND `loan_documents_reviewed_at` IS NULL;
