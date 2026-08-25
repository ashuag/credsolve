INSERT INTO `setting` (`key`, `value`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'MIN_PAY_AMOUNT',
  '100',
  'Minimum online partial repayment amount in INR. If outstanding is below this, the customer must pay the remaining balance in full.',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);
