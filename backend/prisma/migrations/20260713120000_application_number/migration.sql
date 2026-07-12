-- Persist a unique public alphanumeric application reference (exactly 12 chars: APPYYYYXXXXX).
-- At disbursement this value is copied onto loan_account.loan_account_number.

ALTER TABLE `application`
  ADD COLUMN `application_number` VARCHAR(12) NULL;

-- Backfill existing rows with a stable unique value derived from id + year.
UPDATE `application`
SET `application_number` = CONCAT(
  'APP',
  YEAR(`created_at`),
  UPPER(RIGHT(LPAD(CONV(`id`, 10, 36), 5, '0'), 5))
)
WHERE `application_number` IS NULL;

ALTER TABLE `application`
  MODIFY COLUMN `application_number` VARCHAR(12) NOT NULL,
  ADD UNIQUE INDEX `application_application_number_key`(`application_number`);
