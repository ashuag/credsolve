-- Month-specific repayment due date overrides (LOS Masters).
CREATE TABLE `repayment_due_date` (
  `id` SMALLINT NOT NULL AUTO_INCREMENT,
  `year` SMALLINT NOT NULL,
  `month` SMALLINT NOT NULL,
  `due_date` DATE NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `repayment_due_date_year_month_key` (`year`, `month`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
