-- Inbound Easebuzz Pay webhook / surl / furl payloads + Transaction V2.1 confirm.
CREATE TABLE `easebuzz_repayment_notification` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `source` VARCHAR(20) NOT NULL,
  `txnid` VARCHAR(64) NOT NULL DEFAULT '',
  `easepayid` VARCHAR(64) NULL,
  `status` VARCHAR(40) NULL,
  `amount` VARCHAR(20) NULL,
  `loan_account_id` BIGINT UNSIGNED NULL,
  `payload` JSON NOT NULL,
  `confirm_payload` JSON NULL,
  `process_result` VARCHAR(20) NULL,
  `process_code` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `easebuzz_repayment_notification_uuid_key`(`uuid`),
  INDEX `easebuzz_repayment_notification_txnid_created_at_idx`(`txnid`, `created_at`),
  INDEX `easebuzz_repayment_notification_source_created_at_idx`(`source`, `created_at`),
  INDEX `easebuzz_repayment_notification_process_result_created_at_idx`(`process_result`, `created_at`),
  INDEX `easebuzz_repayment_notification_loan_account_id_created_at_idx`(`loan_account_id`, `created_at`),
  CONSTRAINT `easebuzz_repayment_notification_loan_account_id_fkey`
    FOREIGN KEY (`loan_account_id`) REFERENCES `loan_account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
