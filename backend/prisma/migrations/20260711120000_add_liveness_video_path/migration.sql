-- Store the S3/Spaces object key for the short active-liveness video captured during KYC.
ALTER TABLE `application_kyc`
  ADD COLUMN `liveness_video_path` VARCHAR(512) NULL;
