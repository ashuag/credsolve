-- Successful Easebuzz collections that do not close the loan.

ALTER TABLE `loan_repayment`
  MODIFY `status` ENUM('SUCCESS', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'SUCCESS';
