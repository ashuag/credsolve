import {Injectable} from '@nestjs/common';
import {type DatabaseSession} from '../../../../prisma/database-session';
import {PrismaService} from '../../../../prisma/prisma.service';

type CustomerRecord = {
    id: bigint;
    uuid: string;
    mobileNumber: string;
    createdAt: Date;
};

@Injectable()
export class CustomerRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async ensureByMobileNumber(mobileNumber: string, session?: DatabaseSession): Promise<CustomerRecord> {
        const client = session?.tx ?? this.prisma;
        const customer = await client.customer.upsert({
            where: {mobileNumber},
            update: {},
            create: {mobileNumber}
        });

        return {
            id: customer.id,
            uuid: customer.uuid,
            mobileNumber: customer.mobileNumber,
            createdAt: customer.createdAt
        };
    }
}
