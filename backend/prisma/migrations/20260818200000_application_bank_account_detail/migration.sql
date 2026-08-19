-- Per penny-drop attempt (pass or fail) for an application.
CREATE TABLE `application_bank_account_detail` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `bank_account_number` VARCHAR(20) NOT NULL,
  `ifsc_code` VARCHAR(11) NOT NULL,
  `bank_name` VARCHAR(100) NULL,
  `account_holder_name` VARCHAR(100) NULL,
  `name_at_bank` VARCHAR(150) NULL,
  `status` BOOLEAN NOT NULL,
  `penny_drop_vendor_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `application_bank_account_detail_application_id_created_at_idx`(`application_id`, `created_at`),
  INDEX `application_bank_account_detail_application_id_status_idx`(`application_id`, `status`),
  CONSTRAINT `application_bank_account_detail_application_id_fkey`
    FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
