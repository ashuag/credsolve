ALTER TABLE `application`
  ADD COLUMN `selfie_face_validation_json` JSON NULL AFTER `selfie_relative_path`,
  ADD COLUMN `selfie_face_validation_passed` BOOLEAN NOT NULL DEFAULT false AFTER `selfie_face_validation_json`,
  ADD COLUMN `selfie_face_validation_checked_at` DATETIME(3) NULL AFTER `selfie_face_validation_passed`;
