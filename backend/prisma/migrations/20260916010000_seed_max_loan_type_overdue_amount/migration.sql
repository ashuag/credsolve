-- Post-BRE: reject when any CIBIL loan/account type has overdue above this INR amount.
INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'MAX_LOAN_TYPE_OVERDUE_AMOUNT',
  'Max overdue amount per loan type (₹)',
  '0',
  'POST_BRE',
  'Post-BRE rejects when any CIBIL loan/account type has overdue (amount past due) greater than this INR amount',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('OVERDUE_AMOUNT', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
