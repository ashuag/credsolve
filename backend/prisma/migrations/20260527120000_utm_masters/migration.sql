-- UTM master tables (per lead_source), replacing settings-based UTM lists.

CREATE TABLE `utm_source` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `lead_source_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `utm_source_lead_source_id_name_key`(`lead_source_id`, `name`),
    INDEX `utm_source_lead_source_id_idx`(`lead_source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `utm_medium` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `lead_source_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `utm_medium_lead_source_id_name_key`(`lead_source_id`, `name`),
    INDEX `utm_medium_lead_source_id_idx`(`lead_source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `utm_campaign` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `lead_source_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `utm_campaign_lead_source_id_name_key`(`lead_source_id`, `name`),
    INDEX `utm_campaign_lead_source_id_idx`(`lead_source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `utm_source` ADD CONSTRAINT `utm_source_lead_source_id_fkey` FOREIGN KEY (`lead_source_id`) REFERENCES `lead_source`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `utm_medium` ADD CONSTRAINT `utm_medium_lead_source_id_fkey` FOREIGN KEY (`lead_source_id`) REFERENCES `lead_source`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `utm_campaign` ADD CONSTRAINT `utm_campaign_lead_source_id_fkey` FOREIGN KEY (`lead_source_id`) REFERENCES `lead_source`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
