-- Cached IFSC branch records. Lookup checks this table first; a miss calls the vendor API
-- and stores bank name, IFSC, address, city, state, pincode, plus remaining API fields.
CREATE TABLE `ifsc_code` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `ifsc_code` VARCHAR(11) NOT NULL,
  `bank_name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(500) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pincode` VARCHAR(10) NULL,
  `api_payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ifsc_code_ifsc_code_key`(`ifsc_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
