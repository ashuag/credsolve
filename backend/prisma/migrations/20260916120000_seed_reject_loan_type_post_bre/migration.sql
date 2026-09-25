-- Allow comma-separated CIBIL loan type ID lists on eligibility_criteria.value.
ALTER TABLE `eligibility_criteria` MODIFY `value` VARCHAR(255) NOT NULL;

-- Post-BRE: reject when a listed CIBIL loan type exists and is open.
INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'REJECT_OPEN_LOAN_TYPES',
  'Reject open loan type',
  '',
  'POST_BRE',
  'Comma-separated CIBIL loan type IDs (TUEF account types). Post-BRE rejects when any matching tradeline exists and is open',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

-- Post-BRE: reject when a listed CIBIL loan type exists (open or closed).
INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'REJECT_LOAN_TYPES',
  'Reject if loan type',
  '',
  'POST_BRE',
  'Comma-separated CIBIL loan type IDs (TUEF account types). Post-BRE rejects when any matching tradeline exists (open or closed)',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES
  ('REJECT_OPEN_LOAN_TYPE', 1),
  ('REJECT_LOAN_TYPE', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
