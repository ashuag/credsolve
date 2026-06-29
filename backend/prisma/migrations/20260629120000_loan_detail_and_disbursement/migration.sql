-- Restructure application_detail → loan_detail and expand application_disbursement.

ALTER TABLE `application_disbursement`
  ADD COLUMN `loan_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `processing_fee_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `gst_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `disburse_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `expected_repayment_days` MEDIUMINT NULL,
  ADD COLUMN `expected_repayment_date` DATE NULL,
  ADD COLUMN `actual_repayment_date` DATE NULL,
  ADD COLUMN `actual_repayment_days` MEDIUMINT NULL,
  ADD COLUMN `repayment_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `late_fee` DECIMAL(12, 2) NULL;

UPDATE `application_disbursement` ad
INNER JOIN `application_detail` d ON d.application_id = ad.application_id
SET
  ad.loan_amount = COALESCE(ad.amount, d.loan_amount),
  ad.processing_fee_amount = d.processing_fee_amount,
  ad.gst_amount = d.gst_amount,
  ad.disburse_amount = CASE
    WHEN d.loan_amount IS NOT NULL THEN d.loan_amount - COALESCE(d.processing_fee_amount, 0) - COALESCE(d.gst_amount, 0)
    ELSE NULL
  END,
  ad.expected_repayment_days = d.loan_tenure,
  ad.expected_repayment_date = d.loan_maturity_date,
  ad.repayment_amount = d.loan_amount + COALESCE(d.interest_amount, 0) + COALESCE(d.processing_fee_amount, 0) + COALESCE(d.gst_amount, 0);

INSERT INTO `application_disbursement` (
  `uuid`,
  `application_id`,
  `loan_amount`,
  `processing_fee_amount`,
  `gst_amount`,
  `disburse_amount`,
  `expected_repayment_days`,
  `expected_repayment_date`,
  `repayment_amount`,
  `created_at`
)
SELECT
  UUID(),
  d.application_id,
  d.loan_amount,
  d.processing_fee_amount,
  d.gst_amount,
  CASE
    WHEN d.loan_amount IS NOT NULL THEN d.loan_amount - COALESCE(d.processing_fee_amount, 0) - COALESCE(d.gst_amount, 0)
    ELSE NULL
  END,
  d.loan_tenure,
  d.loan_maturity_date,
  d.loan_amount + COALESCE(d.interest_amount, 0) + COALESCE(d.processing_fee_amount, 0) + COALESCE(d.gst_amount, 0),
  NOW()
FROM `application_detail` d
LEFT JOIN `application_disbursement` ad ON ad.application_id = d.application_id
WHERE ad.application_id IS NULL;

RENAME TABLE `application_detail` TO `loan_detail`;

ALTER TABLE `loan_detail`
  CHANGE COLUMN `loan_amount` `selected_loan_amount` DECIMAL(12, 2) NULL,
  CHANGE COLUMN `interest_rate` `interest_rate_percentage` DECIMAL(5, 2) NULL,
  CHANGE COLUMN `processing_fee` `processing_fee_percentage` DECIMAL(5, 2) NULL,
  ADD COLUMN `gst_percentage` DECIMAL(5, 2) NULL;

UPDATE `loan_detail`
SET `gst_percentage` = CASE
  WHEN `processing_fee_amount` IS NOT NULL AND `processing_fee_amount` > 0 AND `gst_amount` IS NOT NULL
    THEN ROUND((`gst_amount` / `processing_fee_amount`) * 100, 2)
  ELSE NULL
END;

ALTER TABLE `loan_detail`
  DROP COLUMN `loan_tenure`,
  DROP COLUMN `interest_amount`,
  DROP COLUMN `processing_fee_amount`,
  DROP COLUMN `gst_amount`,
  DROP COLUMN `loan_maturity_date`,
  DROP COLUMN `loan_disbursement_date`;

ALTER TABLE `application_disbursement`
  DROP COLUMN `amount`,
  DROP COLUMN `utr`;
