-- CreateTable
CREATE TABLE `cibil_credit_assessment` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `bureau_report_id` BIGINT UNSIGNED NOT NULL,
    `risk_score` INTEGER NULL,
    `category` CHAR(1) NOT NULL,
    `category_description` TEXT NOT NULL,
    `credit_status` VARCHAR(20) NOT NULL,
    `rejection_reasons` TEXT NULL,
    `payment_probability_pct` DECIMAL(5, 2) NOT NULL,
    `credit_recommendation` VARCHAR(20) NOT NULL,
    `recommendation_rejection_reason` TEXT NULL,
    `metrics_snapshot` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cibil_credit_assessment_uuid_key`(`uuid`),
    UNIQUE INDEX `cibil_credit_assessment_bureau_report_id_key`(`bureau_report_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cibil_credit_assessment` ADD CONSTRAINT `cibil_credit_assessment_bureau_report_id_fkey` FOREIGN KEY (`bureau_report_id`) REFERENCES `bureau_report`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
