-- First-class close status for loans paid after a charge waiver.
INSERT INTO `loan_status` (`name`, `display_name`, `is_active`)
SELECT 'SETTLED', 'Settled', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `loan_status` WHERE `name` = 'SETTLED'
);
