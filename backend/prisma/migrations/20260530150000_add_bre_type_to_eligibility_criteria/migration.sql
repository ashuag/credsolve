ALTER TABLE `eligibility_criteria`
  ADD COLUMN `bre_type` VARCHAR(20) NOT NULL DEFAULT 'PRE_BRE'
  AFTER `value`;
