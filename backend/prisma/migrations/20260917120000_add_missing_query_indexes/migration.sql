-- Missing indexes for LOS lists, repayment idempotency, negative-list scans,
-- POST-BRE criteria, SMS template lookup, and vendor-log sort.

-- customer: LOS customer list ORDER BY created_at DESC
CREATE INDEX `customer_created_at_idx` ON `customer`(`created_at`);

-- customer_kyc: latest KYC row per customer (customer_id + created_at DESC)
CREATE INDEX `customer_kyc_customer_id_created_at_idx`
  ON `customer_kyc`(`customer_id`, `created_at`);
DROP INDEX `customer_kyc_customer_id_idx` ON `customer_kyc`;

-- state / city: same LOS negative-list scan as pincode
CREATE INDEX `state_is_negative_negative_added_at_idx`
  ON `state`(`is_negative`, `negative_added_at`);
CREATE INDEX `city_is_negative_negative_added_at_idx`
  ON `city`(`is_negative`, `negative_added_at`);

-- eligibility_criteria: POST_BRE load (`bre_type` + `is_active`)
CREATE INDEX `eligibility_criteria_bre_type_is_active_idx`
  ON `eligibility_criteria`(`bre_type`, `is_active`);

-- sms_template: outbound SMS by product
CREATE INDEX `sms_template_product_is_active_idx`
  ON `sms_template`(`product`, `is_active`);

-- user: LOS team list ORDER BY created_at DESC
CREATE INDEX `user_created_at_idx` ON `user`(`created_at`);

-- loan_repayment: Easebuzz settle idempotency (`vendor_ref` + status)
CREATE INDEX `loan_repayment_vendor_ref_status_idx`
  ON `loan_repayment`(`vendor_ref`, `status`);

-- lead_utm: latest UTM for a lead (replaces lead_id-only + created_at-only)
CREATE INDEX `lead_utm_lead_id_created_at_idx`
  ON `lead_utm`(`lead_id`, `created_at`);
DROP INDEX `lead_utm_lead_id_idx` ON `lead_utm`;
DROP INDEX `lead_utm_created_at_idx` ON `lead_utm`;

-- vendor_api_log: LOS list sort by responded_at
CREATE INDEX `vendor_api_log_responded_at_idx` ON `vendor_api_log`(`responded_at`);
