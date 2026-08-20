-- Canonical expiry rejection reason used by LeadExpiryCronService.
-- On utf8mb4_unicode_ci the unique name key treats 'Expired' and 'EXPIRED' as
-- the same row; activate it and store the uppercase code the cron looks up.
INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('EXPIRED', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1, `name` = 'EXPIRED';
