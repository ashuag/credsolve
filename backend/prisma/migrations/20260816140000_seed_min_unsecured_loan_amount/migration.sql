-- Post-BRE: reject when total open unsecured exposure is below this INR amount.
INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'MIN_UNSECURED_LOAN_AMOUNT',
  'Min total unsecured loan amount (₹)',
  '20000',
  'POST_BRE',
  'Post-BRE rejects when the sum of open unsecured tradeline exposure is below this INR amount',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('MIN_UNSECURED_LOAN_AMOUNT_FAILED', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
