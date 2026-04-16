import type {Prisma} from '@prisma/client';
import {SettingKey} from '../../src/common/constants/setting.constants';

export async function seedSetting(prisma: Prisma.TransactionClient) {
    for (const setting of Object.values(SettingKey)) {
        await prisma.setting.upsert({
            where: {key: setting.key},
            update: {
                value: setting.default,
                description: setting.description,
                isActive: true
            },
            create: {
                key: setting.key,
                value: setting.default,
                description: setting.description,
                isActive: true
            }
        });
    }

    console.log(`Settings seeded (${Object.values(SettingKey).length} records)`);
}
