-- Wipe customer journey data (leads, applications, OTPs, vendor logs, loans).
-- Keeps masters: settings, geography, statuses, users, SMS templates, etc.

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `loan_repayment`;
TRUNCATE TABLE `loan_account`;
TRUNCATE TABLE `application_reference`;
TRUNCATE TABLE `application_kyc`;
TRUNCATE TABLE `application_detail`;
TRUNCATE TABLE `application`;
TRUNCATE TABLE `bureau_report`;
TRUNCATE TABLE `vendor_api_log`;
TRUNCATE TABLE `lead_utm`;
TRUNCATE TABLE `lead_detail`;
TRUNCATE TABLE `lead`;
TRUNCATE TABLE `customer_kyc`;
TRUNCATE TABLE `customer`;
TRUNCATE TABLE `otp_request`;

SET FOREIGN_KEY_CHECKS = 1;
