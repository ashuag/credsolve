-- CreateTable
CREATE TABLE `reference_relation` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `reference_relation_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_reference` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `reference_index` SMALLINT NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `mobile_number` VARCHAR(10) NOT NULL,
    `relation_id` SMALLINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_reference_uuid_key`(`uuid`),
    UNIQUE INDEX `lead_reference_lead_id_reference_index_key`(`lead_id`, `reference_index`),
    INDEX `lead_reference_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lead_reference` ADD CONSTRAINT `lead_reference_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_reference` ADD CONSTRAINT `lead_reference_relation_id_fkey` FOREIGN KEY (`relation_id`) REFERENCES `reference_relation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
