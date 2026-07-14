-- Persist Easebuzz quick-transfer response on the loan for LOS loan-tab support.
ALTER TABLE `loan_account`
  ADD COLUMN `gateway_transfer_json` JSON NULL AFTER `utr`;
