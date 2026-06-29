-- Loan document acceptance audit lives on application_details; application_agreement is redundant.

ALTER TABLE `application_details`
  ADD COLUMN `loan_documents_accepted_ip` VARCHAR(45) NULL AFTER `loan_documents_accepted_at`;

UPDATE `application_details` ad
INNER JOIN `application_agreement` aa ON aa.`application_id` = ad.`application_id`
SET
  ad.`loan_documents_accepted_at` = COALESCE(ad.`loan_documents_accepted_at`, aa.`signed_at`),
  ad.`loan_documents_accepted_ip` = aa.`ip_address`;

DROP TABLE `application_agreement`;
