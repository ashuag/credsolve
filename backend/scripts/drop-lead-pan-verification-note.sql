-- Run after deploying code that removes `panVerificationNote` from Prisma schema.
-- PAN / policy text continues on `lead.lead_status_note` (VARCHAR 256).
ALTER TABLE `lead` DROP COLUMN `pan_verification_note`;
