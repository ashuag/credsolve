-- loan_status master, loan_account + loan_repayment, staging fields on loan_detail, drop application_disbursement.

ALTER TABLE `loan_detail`
  ADD COLUMN `expected_repayment_days` MEDIUMINT NULL,
  ADD COLUMN `expected_repayment_date` DATE NULL,
  ADD COLUMN `bank_account_number` VARCHAR(20) NULL,
  ADD COLUMN `ifsc_code` VARCHAR(11) NULL,
  ADD COLUMN `bank_name` VARCHAR(100) NULL;

UPDATE `loan_detail` ld
INNER JOIN `application_disbursement` ad ON ad.application_id = ld.application_id
SET
  ld.expected_repayment_days = ad.expected_repayment_days,
  ld.expected_repayment_date = ad.expected_repayment_date,
  ld.bank_account_number = ad.account_number,
  ld.ifsc_code = ad.ifsc_code,
  ld.bank_name = ad.bank_name;

CREATE TABLE `loan_status` (
  `id` SMALLINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(20) NOT NULL,
  `display_name` VARCHAR(50) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `loan_status_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `loan_status` (`name`, `display_name`, `is_active`) VALUES
  ('ACTIVE', 'Active', true),
  ('OVERDUE', 'Overdue', true),
  ('CLOSED', 'Closed', true),
  ('WRITTEN_OFF', 'Written off', true);

CREATE TABLE `loan_account` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `loan_account_number` VARCHAR(30) NOT NULL,
  `principal_amount` DECIMAL(12, 2) NOT NULL,
  `net_disbursed_amount` DECIMAL(12, 2) NOT NULL,
  `interest_rate` DECIMAL(5, 2) NOT NULL,
  `interest_amount` DECIMAL(12, 2) NOT NULL,
  `total_repayment_amount` DECIMAL(12, 2) NOT NULL,
  `disbursed_at` DATETIME(3) NOT NULL,
  `loan_maturity_date` DATE NOT NULL,
  `utr` VARCHAR(50) NULL,
  `bank_account_number` VARCHAR(20) NULL,
  `ifsc_code` VARCHAR(11) NULL,
  `loan_status_id` SMALLINT NOT NULL,
  `closed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `loan_account_uuid_key`(`uuid`),
  UNIQUE INDEX `loan_account_application_id_key`(`application_id`),
  UNIQUE INDEX `loan_account_number_key`(`loan_account_number`),
  INDEX `loan_account_customer_id_loan_status_id_idx`(`customer_id`, `loan_status_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `loan_account` (
  `uuid`,
  `application_id`,
  `customer_id`,
  `loan_account_number`,
  `principal_amount`,
  `net_disbursed_amount`,
  `interest_rate`,
  `interest_amount`,
  `total_repayment_amount`,
  `disbursed_at`,
  `loan_maturity_date`,
  `utr`,
  `bank_account_number`,
  `ifsc_code`,
  `loan_status_id`,
  `created_at`,
  `updated_at`
)
SELECT
  UUID(),
  ad.application_id,
  a.customer_id,
  CONCAT(
    'MC-',
    DATE_FORMAT(ad.disbursed_at, '%y%m'),
    '-',
    LPAD(ad.application_id, 5, '0')
  ),
  COALESCE(ad.loan_amount, ld.selected_loan_amount, 0),
  COALESCE(ad.disburse_amount, 0),
  COALESCE(ld.interest_rate_percentage, 0),
  GREATEST(
    0,
    COALESCE(ad.repayment_amount, 0)
      - COALESCE(ad.loan_amount, ld.selected_loan_amount, 0)
      - COALESCE(ad.processing_fee_amount, 0)
      - COALESCE(ad.gst_amount, 0)
  ),
  COALESCE(ad.repayment_amount, 0),
  ad.disbursed_at,
  COALESCE(ad.expected_repayment_date, ad.disbursed_at),
  NULL,
  ad.account_number,
  ad.ifsc_code,
  (SELECT `id` FROM `loan_status` WHERE `name` = 'ACTIVE' LIMIT 1),
  ad.disbursed_at,
  ad.disbursed_at
FROM `application_disbursement` ad
INNER JOIN `application` a ON a.id = ad.application_id
LEFT JOIN `loan_detail` ld ON ld.application_id = ad.application_id
WHERE ad.disbursed_at IS NOT NULL;

CREATE TABLE `loan_repayment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `loan_account_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `payment_mode` ENUM('UPI', 'NEFT', 'IMPS', 'CASH') NOT NULL,
  `utr` VARCHAR(50) NULL,
  `paid_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `loan_repayment_uuid_key`(`uuid`),
  INDEX `loan_repayment_loan_account_id_paid_at_idx`(`loan_account_id`, `paid_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loan_account`
  ADD CONSTRAINT `loan_account_application_id_fkey`
    FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `loan_account_customer_id_fkey`
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `loan_account_loan_status_id_fkey`
    FOREIGN KEY (`loan_status_id`) REFERENCES `loan_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `loan_repayment`
  ADD CONSTRAINT `loan_repayment_loan_account_id_fkey`
    FOREIGN KEY (`loan_account_id`) REFERENCES `loan_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE `application_disbursement`;
