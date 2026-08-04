-- Bounce charge schedule (amount band → fee), used in sanction letter & overdue repayment.
CREATE TABLE `bounce_charge_tier` (
  `id` SMALLINT NOT NULL AUTO_INCREMENT,
  `min_amount_inr` INT NOT NULL,
  `max_amount_inr` INT NULL,
  `bounce_fee_inr` DECIMAL(12, 2) NOT NULL,
  `sort_order` SMALLINT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
