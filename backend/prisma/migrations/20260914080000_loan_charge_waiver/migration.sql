-- Waiver of negotiable overdue charges (penal + overdue-days interest) and SETTLED close status.

ALTER TABLE `loan_account`
  ADD COLUMN `waived_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `waived_by_user_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `waived_at` DATETIME(3) NULL;

CREATE INDEX `loan_account_waived_by_user_id_idx` ON `loan_account`(`waived_by_user_id`);

ALTER TABLE `loan_account`
  ADD CONSTRAINT `loan_account_waived_by_user_id_fkey`
    FOREIGN KEY (`waived_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `loan_status` (`name`, `display_name`, `is_active`)
SELECT 'SETTLED', 'Settled', 1
WHERE NOT EXISTS (SELECT 1 FROM `loan_status` WHERE `name` = 'SETTLED');
