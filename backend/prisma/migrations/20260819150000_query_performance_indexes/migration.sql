-- Indexes for LOS list/dashboard filters, PAN uniqueness checks, OTP lookup,
-- loan overdue cron, and vendor API log date sorts.

-- lead: list (is_active + is_internal_testing + created_at), dashboard groupBy, expiry
CREATE INDEX `lead_is_active_is_internal_testing_created_at_idx`
  ON `lead`(`is_active`, `is_internal_testing`, `created_at`);
CREATE INDEX `lead_is_active_lead_status_id_idx`
  ON `lead`(`is_active`, `lead_status_id`);
CREATE INDEX `lead_is_active_created_at_idx`
  ON `lead`(`is_active`, `created_at`);

-- lead_detail: PAN already-linked-to-other-phone lookup
CREATE INDEX `lead_detail_pan_number_idx` ON `lead_detail`(`pan_number`);

-- vendor_api_log: default sort / date range / HTTP status filter
CREATE INDEX `vendor_api_log_requested_at_idx` ON `vendor_api_log`(`requested_at`);
CREATE INDEX `vendor_api_log_http_status_requested_at_idx`
  ON `vendor_api_log`(`http_status`, `requested_at`);

-- application: list + dashboard daily counts + recent activity
CREATE INDEX `application_created_at_idx` ON `application`(`created_at`);
CREATE INDEX `application_updated_at_idx` ON `application`(`updated_at`);

-- application_kyc: dashboard pending KYC / liveness counts
CREATE INDEX `application_kyc_kyc_status_liveness_passed_idx`
  ON `application_kyc`(`kyc_status`, `liveness_passed`);

-- loan_account: list/dashboard by disbursement date; overdue cron
CREATE INDEX `loan_account_disbursed_at_idx` ON `loan_account`(`disbursed_at`);
CREATE INDEX `loan_account_loan_status_id_closed_at_loan_maturity_date_idx`
  ON `loan_account`(`loan_status_id`, `closed_at`, `loan_maturity_date`);

-- pincode: LOS negative-list scan
CREATE INDEX `pincode_is_negative_negative_added_at_idx`
  ON `pincode`(`is_negative`, `negative_added_at`);

-- otp_request: pending OTP by value+type, newest first
CREATE INDEX `otp_request_value_type_id_last_sent_at_idx`
  ON `otp_request`(`value`, `type_id`, `last_sent_at`);
DROP INDEX `otp_request_value_type_id_idx` ON `otp_request`;
