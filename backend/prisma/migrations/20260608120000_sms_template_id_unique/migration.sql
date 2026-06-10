-- Allow multiple SMS templates under the same gateway product (e.g. login OTP + eSign OTP both use product `OTP`).
DROP INDEX `sms_template_product_key` ON `sms_template`;
CREATE UNIQUE INDEX `sms_template_template_id_key` ON `sms_template`(`template_id`);
