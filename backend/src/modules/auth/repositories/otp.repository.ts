import {Injectable} from '@nestjs/common';
import {type UtmTrackingParams} from '../../../common/types/utm-tracking.types';
import {type DatabaseSession} from '../../../../prisma/database-session';
import {PrismaService} from '../../../../prisma/prisma.service';

type RecentOtpWindowParams = {
    value: string;
    typeId: number;
    ipAddress?: string;
    windowStart: Date;
};

export type OtpVerificationRecord = {
    id: number;
    uuid: string;
    value: string;
    otpCode: string;
    expiresAt: Date;
    attemptCount: number;
    verifiedAt: Date | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
};

export type ActiveOtpTypeRecord = {
    id: number;
    name: string;
};

@Injectable()
export class OtpRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async findActiveTypes(session?: DatabaseSession): Promise<ActiveOtpTypeRecord[]> {
        const client = session?.tx ?? this.prisma;

        return client.otpType.findMany({
            where: {isActive: true},
            orderBy: {id: 'asc'},
            select: {
                id: true,
                name: true
            }
        });
    }

    async getRecentRequestWindowStats(
        params: RecentOtpWindowParams,
        session?: DatabaseSession
    ): Promise<{ count: number; oldestAt?: Date }> {
        const client = session?.tx ?? this.prisma;

        const aggregate = await client.otpRequest.aggregate({
            where: {
                value: params.value,
                typeId: params.typeId,
                ...(params.ipAddress ? {ipAddress: params.ipAddress} : {}),
                createdAt: {gte: params.windowStart}
            },
            _count: {_all: true},
            _min: {createdAt: true}
        });

        return {
            count: aggregate._count._all,
            oldestAt: aggregate._min.createdAt ?? undefined
        };
    }

    async findLatestActiveRequest(params: {
        value: string;
        typeId: number;
        now: Date;
    }, session?: DatabaseSession): Promise<{ lastSentAt: Date } | undefined> {
        const client = session?.tx ?? this.prisma;
        const otpRequest = await client.otpRequest.findFirst({
            where: {
                value: params.value,
                typeId: params.typeId,
                verifiedAt: null,
                expiresAt: {gt: params.now}
            },
            orderBy: {createdAt: 'desc'},
            select: {
                lastSentAt: true
            }
        });

        return otpRequest ?? undefined;
    }

    async createOtpRequest(params: {
        value: string;
        typeId: number;
        otpCode: string;
        expiresAt: Date;
        ipAddress?: string;
        utmParams?: UtmTrackingParams;
    }, session?: DatabaseSession): Promise<{ id: number; uuid: string }> {
        const client = session?.tx ?? this.prisma;

        return client.otpRequest.create({
            data: {
                value: params.value,
                typeId: params.typeId,
                otpCode: params.otpCode,
                expiresAt: params.expiresAt,
                ...(params.ipAddress ? {ipAddress: params.ipAddress} : {}),
                ...(params.utmParams?.utmSource ? {utmSource: params.utmParams.utmSource} : {}),
                ...(params.utmParams?.utmMedium ? {utmMedium: params.utmParams.utmMedium} : {}),
                ...(params.utmParams?.utmCampaign ? {utmCampaign: params.utmParams.utmCampaign} : {}),
                ...(params.utmParams?.utmTerm ? {utmTerm: params.utmParams.utmTerm} : {}),
                ...(params.utmParams?.utmContent ? {utmContent: params.utmParams.utmContent} : {})
            },
            select: {
                id: true,
                uuid: true,
            }
        });
    }

    async findRequestForVerification(params: {
        requestId: string;
    }, session?: DatabaseSession): Promise<OtpVerificationRecord | null> {
        const client = session?.tx ?? this.prisma;

        return client.otpRequest.findFirst({
            where: {
                uuid: params.requestId
            },
            select: {
                id: true,
                uuid: true,
                value: true,
                otpCode: true,
                expiresAt: true,
                attemptCount: true,
                verifiedAt: true,
                utmSource: true,
                utmMedium: true,
                utmCampaign: true,
                utmTerm: true,
                utmContent: true
            }
        });
    }

    async updateAttemptCount(requestId: number, attemptCount: number, session?: DatabaseSession): Promise<void> {
        const client = session?.tx ?? this.prisma;

        await client.otpRequest.update({
            where: {id: requestId},
            data: {attemptCount}
        });
    }

    async markVerified(
        requestId: number,
        verifiedAt: Date,
        session?: DatabaseSession,
    ): Promise<{ id: number; uuid: string; verifiedAt: Date | null }> {
        const client = session?.tx ?? this.prisma;

        return client.otpRequest.update({
            where: {id: requestId},
            data: {verifiedAt},
            select: {
                id: true,
                uuid: true,
                verifiedAt: true
            }
        });
    }

    async deletePendingRequest(requestId: number, session?: DatabaseSession): Promise<void> {
        const client = session?.tx ?? this.prisma;

        await client.otpRequest.deleteMany({
            where: {
                id: requestId,
                verifiedAt: null
            }
        });
    }
}
