-- SMS delivery report (DLR) tracking on OTP requests.
ALTER TABLE `otp_request`
  ADD COLUMN `sms_message_id` VARCHAR(64) NULL,
  ADD COLUMN `sms_delivery_status` VARCHAR(32) NULL,
  ADD COLUMN `sms_delivery_code` VARCHAR(16) NULL,
  ADD COLUMN `sms_submit_at` DATETIME(3) NULL,
  ADD COLUMN `sms_dlr_received_at` DATETIME(3) NULL,
  ADD COLUMN `sms_dlr_payload` JSON NULL;

CREATE INDEX `otp_request_sms_message_id_idx` ON `otp_request`(`sms_message_id`);
CREATE INDEX `otp_request_sms_delivery_status_idx` ON `otp_request`(`sms_delivery_status`);
