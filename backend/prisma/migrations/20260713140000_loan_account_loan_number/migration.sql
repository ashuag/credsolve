-- Add public loan_number (application_number) on loan_account.

ALTER TABLE `loan_account`
  ADD COLUMN `loan_number` VARCHAR(12) NULL AFTER `customer_id`;

UPDATE `loan_account` la
INNER JOIN `application` a ON a.id = la.application_id
SET la.loan_number = a.application_number
WHERE la.loan_number IS NULL;

ALTER TABLE `loan_account`
  MODIFY COLUMN `loan_number` VARCHAR(12) NOT NULL,
  ADD UNIQUE INDEX `loan_account_loan_number_key`(`loan_number`);
