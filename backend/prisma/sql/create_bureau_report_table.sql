-- Bureau / CIBIL snapshot from Tenacio Experian soft-pull (run after deploy).
CREATE TABLE `bureau_report` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `lead_id` BIGINT UNSIGNED NOT NULL,
  `cibil_score` INT NULL,
  `html_url` TEXT NULL,
  `vendor_request_id` VARCHAR(64) NULL,
  `service_status_code` SMALLINT NULL,
  `response_status` VARCHAR(64) NULL,
  `raw_payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `bureau_report_uuid_key` (`uuid`),
  KEY `bureau_report_customer_id_created_at_idx` (`customer_id`, `created_at`),
  KEY `bureau_report_lead_id_created_at_idx` (`lead_id`, `created_at`),
  CONSTRAINT `bureau_report_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bureau_report_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
