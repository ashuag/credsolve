-- Automated bureau soft-pull transport / non-success failures (recoverable on re-fetch).
-- REJECTED_BY_CLIENTS remains manual-only in LOS.
INSERT INTO `rejection_reason` (`name`, `is_active`)
VALUES ('BUREAU_SOFT_PULL_FAILED', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;
