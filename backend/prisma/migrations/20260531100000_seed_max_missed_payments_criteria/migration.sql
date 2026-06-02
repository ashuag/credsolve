-- Insert MAX_MISSED_PAYMENTS_6_MONTHS eligibility criterion if not already present.
INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'MAX_MISSED_PAYMENTS_6_MONTHS',
  'Max missed payments in last 6 months',
  '1',
  'POST_BRE',
  'Customer must have ≤ this many months with any DPD > 0 across all tradelines in the past 6 months',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;
