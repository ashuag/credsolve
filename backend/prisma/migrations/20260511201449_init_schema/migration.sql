-- CreateTable
CREATE TABLE `application` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `application_status_id` SMALLINT NOT NULL,
    `kyc_completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `application_uuid_key`(`uuid`),
    INDEX `application_customer_id_application_status_id_idx`(`customer_id`, `application_status_id`),
    INDEX `application_lead_id_idx`(`lead_id`),
    INDEX `application_application_status_id_idx`(`application_status_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_details` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `reason_for_loan_id` SMALLINT NULL,
    `loan_amount` DECIMAL(12, 2) NULL,
    `loan_tenure` MEDIUMINT NULL,
    `interest_rate` DECIMAL(5, 2) NULL,
    `interest_amount` DECIMAL(12, 2) NULL,
    `processing_fee` DECIMAL(5, 2) NULL,
    `processing_fee_amount` DECIMAL(12, 2) NULL,
    `gst_amount` DECIMAL(12, 2) NULL,
    `loan_disbursement_date` DATE NULL,
    `loan_maturity_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `application_details_uuid_key`(`uuid`),
    UNIQUE INDEX `application_details_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_eligibility` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `is_eligible` BOOLEAN NOT NULL,
    `approved_amount` DECIMAL(12, 2) NULL,
    `cibil_score` INTEGER NULL,
    `ineligible_reason` VARCHAR(500) NULL,
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `application_eligibility_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_agreement` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `document_name` VARCHAR(255) NULL,
    `ip_address` VARCHAR(45) NULL,
    `signed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `application_agreement_uuid_key`(`uuid`),
    UNIQUE INDEX `application_agreement_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_disbursement` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `application_id` BIGINT UNSIGNED NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `account_number` VARCHAR(20) NULL,
    `ifsc_code` VARCHAR(11) NULL,
    `bank_name` VARCHAR(100) NULL,
    `utr` VARCHAR(50) NULL,
    `disbursed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `application_disbursement_uuid_key`(`uuid`),
    UNIQUE INDEX `application_disbursement_application_id_key`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setting` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `setting_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eligibility_criteria` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `label` VARCHAR(200) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `eligibility_criteria_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_limit_tier` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `min_unsecured_loan` INTEGER NOT NULL,
    `max_unsecured_loan` INTEGER NULL,
    `max_bullet_loan` INTEGER NOT NULL,
    `sort_order` SMALLINT NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `mobile_number` CHAR(10) NOT NULL,
    `kyc_verified_at` DATETIME(3) NULL,
    `is_blacklisted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_uuid_key`(`uuid`),
    UNIQUE INDEX `customer_mobile_number_key`(`mobile_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_kyc` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `pan_number` CHAR(10) NULL,
    `pan_verified_at` DATETIME(3) NULL,
    `full_name` VARCHAR(100) NULL,
    `date_of_birth` DATE NULL,
    `kyc_verified_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_kyc_uuid_key`(`uuid`),
    INDEX `customer_kyc_customer_id_idx`(`customer_id`),
    INDEX `customer_kyc_pan_number_idx`(`pan_number`),
    INDEX `customer_kyc_kyc_verified_at_idx`(`kyc_verified_at`),
    INDEX `customer_kyc_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_kyc_document` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `customer_kyc_id` BIGINT UNSIGNED NOT NULL,
    `document_type_id` SMALLINT NOT NULL,
    `kyc_provider_id` SMALLINT NOT NULL,
    `file_name` VARCHAR(255) NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_kyc_document_uuid_key`(`uuid`),
    INDEX `customer_kyc_document_customer_kyc_id_idx`(`customer_kyc_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `state` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(5) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `state_name_key`(`name`),
    UNIQUE INDEX `state_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `city` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `state_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `city_state_id_idx`(`state_id`),
    UNIQUE INDEX `city_name_state_id_key`(`name`, `state_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `negative_pincode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pincode` CHAR(6) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `negative_pincode_pincode_key`(`pincode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `negative_state` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `state_id` INTEGER NOT NULL,
    `reason` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `negative_state_state_id_key`(`state_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `negative_city` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `city_id` INTEGER NOT NULL,
    `reason` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `negative_city_city_id_key`(`city_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `email` VARCHAR(100) NULL,
    `email_verification_type` ENUM('GOOGLE', 'OTP') NULL,
    `lead_status_id` SMALLINT NOT NULL DEFAULT 1,
    `source_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_uuid_key`(`uuid`),
    INDEX `lead_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `lead_email_idx`(`email`),
    INDEX `lead_lead_status_id_idx`(`lead_status_id`),
    INDEX `lead_source_id_idx`(`source_id`),
    INDEX `lead_expires_at_idx`(`expires_at`),
    INDEX `lead_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_detail` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `full_name` VARCHAR(100) NULL,
    `date_of_birth` DATE NULL,
    `gender_id` SMALLINT NULL,
    `pan_number` CHAR(10) NULL,
    `pan_verified` BOOLEAN NOT NULL DEFAULT false,
    `pan_verified_at` DATETIME(3) NULL,
    `city_id` INTEGER NULL,
    `pincode` CHAR(6) NULL,
    `address_line_1` TINYTEXT NULL,
    `address_line_2` TINYTEXT NULL,
    `occupation_id` SMALLINT NULL,
    `net_monthly_income` DECIMAL(12, 2) NULL,
    `annual_turnover` DECIMAL(12, 2) NULL,
    `annual_profit` DECIMAL(12, 2) NULL,
    `cibil_consent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_detail_uuid_key`(`uuid`),
    UNIQUE INDEX `lead_detail_lead_id_key`(`lead_id`),
    INDEX `lead_detail_city_id_idx`(`city_id`),
    INDEX `lead_detail_pincode_idx`(`pincode`),
    INDEX `lead_detail_pan_verified_pan_verified_at_idx`(`pan_verified`, `pan_verified_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_api_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `provider_name` VARCHAR(100) NOT NULL,
    `service_name` VARCHAR(120) NOT NULL,
    `request_method` ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE') NOT NULL,
    `request_path` VARCHAR(255) NULL,
    `lead_id` BIGINT UNSIGNED NULL,
    `request_headers` JSON NULL,
    `request_payload` JSON NOT NULL,
    `response_payload` JSON NULL,
    `http_status` INTEGER NULL,
    `requested_at` DATETIME(3) NOT NULL,
    `responded_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_api_log_uuid_key`(`uuid`),
    INDEX `vendor_api_log_lead_id_idx`(`lead_id`),
    INDEX `vendor_api_log_provider_name_requested_at_idx`(`provider_name`, `requested_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_utm` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `utm_source` VARCHAR(100) NULL,
    `utm_medium` VARCHAR(100) NULL,
    `utm_campaign` VARCHAR(100) NULL,
    `utm_term` VARCHAR(100) NULL,
    `utm_content` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lead_utm_uuid_key`(`uuid`),
    INDEX `lead_utm_lead_id_idx`(`lead_id`),
    INDEX `lead_utm_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gender` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `gender_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `occupation` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `occupation_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reason_for_loan` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reason_for_loan_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_type` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `otp_type_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_provider` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `kyc_provider_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_document` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `kyc_document_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_source` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `type` ENUM('ADS', 'CONNECTOR', 'SALES', 'ORGANIC', 'PARTNER', 'API') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `lead_source_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_status` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `lead_status_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_status` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `display_name` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `application_status_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `type_id` SMALLINT NOT NULL,
    `otp_code` VARCHAR(6) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `attempt_count` SMALLINT NOT NULL DEFAULT 0,
    `last_sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `utm_source` VARCHAR(100) NULL,
    `utm_medium` VARCHAR(100) NULL,
    `utm_campaign` VARCHAR(100) NULL,
    `utm_term` VARCHAR(100) NULL,
    `utm_content` VARCHAR(100) NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `otp_request_uuid_key`(`uuid`),
    INDEX `otp_request_value_type_id_idx`(`value`, `type_id`),
    INDEX `otp_request_expires_at_idx`(`expires_at`),
    INDEX `otp_request_verified_at_idx`(`verified_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `hierarchy_level` SMALLINT NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL,

    UNIQUE INDEX `user_role_name_key`(`name`),
    INDEX `user_role_hierarchy_level_idx`(`hierarchy_level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password` VARCHAR(255) NULL,
    `role_id` SMALLINT NOT NULL,
    `manager_id` BIGINT UNSIGNED NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `invitation_token_hash` CHAR(64) NULL,
    `invitation_sent_at` DATETIME(3) NULL,
    `invitation_expires_at` DATETIME(3) NULL,
    `registration_completed_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    UNIQUE INDEX `user_invitation_token_hash_key`(`invitation_token_hash`),
    INDEX `user_manager_id_idx`(`manager_id`),
    INDEX `user_role_id_idx`(`role_id`),
    INDEX `user_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `application` ADD CONSTRAINT `application_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application` ADD CONSTRAINT `application_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application` ADD CONSTRAINT `application_application_status_id_fkey` FOREIGN KEY (`application_status_id`) REFERENCES `application_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_details` ADD CONSTRAINT `application_details_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_details` ADD CONSTRAINT `application_details_reason_for_loan_id_fkey` FOREIGN KEY (`reason_for_loan_id`) REFERENCES `reason_for_loan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_eligibility` ADD CONSTRAINT `application_eligibility_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_agreement` ADD CONSTRAINT `application_agreement_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_disbursement` ADD CONSTRAINT `application_disbursement_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_kyc` ADD CONSTRAINT `customer_kyc_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_kyc_document` ADD CONSTRAINT `customer_kyc_document_customer_kyc_id_fkey` FOREIGN KEY (`customer_kyc_id`) REFERENCES `customer_kyc`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_kyc_document` ADD CONSTRAINT `customer_kyc_document_kyc_provider_id_fkey` FOREIGN KEY (`kyc_provider_id`) REFERENCES `kyc_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_kyc_document` ADD CONSTRAINT `customer_kyc_document_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `kyc_document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `city` ADD CONSTRAINT `city_state_id_fkey` FOREIGN KEY (`state_id`) REFERENCES `state`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_state` ADD CONSTRAINT `negative_state_state_id_fkey` FOREIGN KEY (`state_id`) REFERENCES `state`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_city` ADD CONSTRAINT `negative_city_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `city`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_lead_status_id_fkey` FOREIGN KEY (`lead_status_id`) REFERENCES `lead_status`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `lead_source`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_detail` ADD CONSTRAINT `lead_detail_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_detail` ADD CONSTRAINT `lead_detail_gender_id_fkey` FOREIGN KEY (`gender_id`) REFERENCES `gender`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_detail` ADD CONSTRAINT `lead_detail_occupation_id_fkey` FOREIGN KEY (`occupation_id`) REFERENCES `occupation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_detail` ADD CONSTRAINT `lead_detail_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `city`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_api_log` ADD CONSTRAINT `vendor_api_log_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_utm` ADD CONSTRAINT `lead_utm_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_request` ADD CONSTRAINT `otp_request_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `otp_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `user_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
