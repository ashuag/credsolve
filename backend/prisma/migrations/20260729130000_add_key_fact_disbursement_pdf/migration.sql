-- Preserve customer-acceptance KFS separately from the revised disbursement KFS.
ALTER TABLE `application_detail`
  ADD COLUMN `key_fact_disbursement_pdf_relative_path` VARCHAR(512) NULL AFTER `key_fact_esigned`,
  ADD COLUMN `key_fact_disbursement_esigned` BOOLEAN NOT NULL DEFAULT false AFTER `key_fact_disbursement_pdf_relative_path`;
