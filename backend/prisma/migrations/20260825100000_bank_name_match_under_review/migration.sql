-- Credit review when penny-drop succeeds but customer name vs bank account name does not auto-match.
INSERT INTO `application_status` (`name`, `display_name`, `is_active`)
VALUES ('UNDER_REVIEW', 'Under review', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1, `display_name` = VALUES(`display_name`);

INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('BANK_NAME_MISMATCH', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;

INSERT INTO `setting` (`key`, `value`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'PENNY_DROP_NAME_MATCH_MIN_SCORE',
  '100',
  'Minimum 0–100 fuzzing score between customer name and penny-drop bank account name to auto-pass. Below this, the application goes to UNDER_REVIEW for credit.',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);

ALTER TABLE `application_bank_account_detail`
  ADD COLUMN `name_match_score` SMALLINT NULL AFTER `status`;
