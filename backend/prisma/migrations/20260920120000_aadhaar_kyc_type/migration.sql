ALTER TABLE `customer_kyc`
  ADD COLUMN `aadhaar_kyc_type` SMALLINT NULL AFTER `aadhaar_photo_path`;

UPDATE `customer_kyc`
SET `aadhaar_kyc_type` = CASE
  WHEN `aadhaar_kyc_process` = 'OTP' THEN 2
  WHEN `aadhaar_kyc_process` = 'DIGILOCKER' THEN 1
  WHEN `aadhaar_kyc_process` IS NULL
    AND (
      `aadhaar_verified_at` IS NOT NULL
      OR `aadhaar_data` IS NOT NULL
      OR `aadhaar_photo_path` IS NOT NULL
    ) THEN 1
  ELSE NULL
END;

ALTER TABLE `customer_kyc`
  DROP COLUMN `aadhaar_kyc_process`;
