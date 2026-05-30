ALTER TABLE `application`
  ADD COLUMN `liveness_done` tinyint(1) NOT NULL DEFAULT 0 AFTER `liveness_passed`,
  ADD COLUMN `liveness_done_at` datetime(3) NULL AFTER `liveness_done`;
