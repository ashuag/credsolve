-- Loan repayment outcomes for customer Pay Now (Easebuzz): SUCCESS closes loan; FAILED shown in LOS.
ALTER TABLE `loan_repayment`
  ADD COLUMN `status` ENUM('SUCCESS', 'FAILED') NOT NULL DEFAULT 'SUCCESS' AFTER `payment_mode`,
  ADD COLUMN `failure_message` VARCHAR(500) NULL AFTER `utr`,
  ADD COLUMN `vendor_ref` VARCHAR(64) NULL AFTER `failure_message`;

CREATE INDEX `loan_repayment_loan_account_id_status_idx` ON `loan_repayment`(`loan_account_id`, `status`);
