-- Payout is in flight until Easebuzz reports Success. Failure is a separate terminal status.
INSERT INTO `application_status` (`name`, `display_name`, `is_active`)
VALUES
  ('DISBURSAL_INPROCESS', 'Disbursal in process', 1),
  ('DISBURSAL_FAILED', 'Disbursal failed', 1)
ON DUPLICATE KEY UPDATE
  `is_active` = 1,
  `display_name` = VALUES(`display_name`);

ALTER TABLE `application_detail`
  ADD COLUMN `disbursement_unique_request_number` VARCHAR(40) NULL;
