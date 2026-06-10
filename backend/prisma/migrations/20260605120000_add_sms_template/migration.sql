-- CreateTable
CREATE TABLE `sms_template` (
    `id` SMALLINT NOT NULL AUTO_INCREMENT,
    `template_id` VARCHAR(40) NOT NULL,
    `bearer_token` VARCHAR(255) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `product` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sms_template_product_key`(`product`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
