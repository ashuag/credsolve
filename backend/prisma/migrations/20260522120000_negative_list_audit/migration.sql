-- AlterTable
ALTER TABLE `negative_pincode` ADD COLUMN `added_by_user_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `removed_by_user_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `removed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `negative_state` ADD COLUMN `added_by_user_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `removed_by_user_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `removed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `negative_city` ADD COLUMN `added_by_user_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `removed_by_user_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `removed_at` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `negative_pincode` ADD CONSTRAINT `negative_pincode_added_by_user_id_fkey` FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_pincode` ADD CONSTRAINT `negative_pincode_removed_by_user_id_fkey` FOREIGN KEY (`removed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_state` ADD CONSTRAINT `negative_state_added_by_user_id_fkey` FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_state` ADD CONSTRAINT `negative_state_removed_by_user_id_fkey` FOREIGN KEY (`removed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_city` ADD CONSTRAINT `negative_city_added_by_user_id_fkey` FOREIGN KEY (`added_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `negative_city` ADD CONSTRAINT `negative_city_removed_by_user_id_fkey` FOREIGN KEY (`removed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
