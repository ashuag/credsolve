-- Contact email captured on the address step.
-- Distinct from application_detail.email_id (OTP/Google verified after loan selection).

ALTER TABLE `lead_detail`
  ADD COLUMN `email_id` VARCHAR(150) NULL AFTER `address_line_2`;
