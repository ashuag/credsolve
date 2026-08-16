-- Post-BRE: reject when CIBIL credit-assessment grade is in this set.
INSERT INTO `eligibility_criteria` (`key`, `label`, `value`, `bre_type`, `description`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'REJECTED_CREDIT_ASSESSMENT_GRADES',
  'Rejected credit assessment grades',
  'E,F,G,H',
  'POST_BRE',
  'Comma-separated list of CIBIL credit-assessment grades (A–H) that fail post-BRE',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('CREDIT_ASSESSMENT_GRADE_FAILED', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
