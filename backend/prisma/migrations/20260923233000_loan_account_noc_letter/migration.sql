-- NOC / loan-closure letter tracking on loan_account
ALTER TABLE `loan_account`
  ADD COLUMN `is_noc_sent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `noc_sent_at` DATETIME(3) NULL,
  ADD COLUMN `noc_pdf_relative_path` VARCHAR(512) NULL,
  ADD COLUMN `noc_letter_number` VARCHAR(40) NULL;

CREATE UNIQUE INDEX `loan_account_noc_letter_number_key` ON `loan_account`(`noc_letter_number`);
