import {Injectable} from '@nestjs/common';
import {type DatabaseSession} from '../../../../prisma/database-session';
import {PrismaService} from '../../../../prisma/prisma.service';
import {type UtmTrackingParams} from '../../../common/types/utm-tracking.types';
import {OTP_TYPE} from '../../../common/constants/otp.constants';

@Injectable()
export class LeadRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async findLatestStateByCustomerId(
        customerId: bigint,
        session?: DatabaseSession
    ): Promise<{ uuid: string; email: string | null; leadStatus: string } | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                customerId,
                isActive: true
            },
            orderBy: {createdAt: 'desc'},
            select: {
                uuid: true,
                email: true,
                leadStatus: {
                    select: {name: true}
                }
            }
        });

        return lead
            ? {uuid: lead.uuid, email: lead.email, leadStatus: lead.leadStatus.name}
            : undefined;
    }

    async findLatestStateByCustomerUuid(
        customerUuid: string,
        session?: DatabaseSession
    ): Promise<{ uuid: string; email: string | null; leadStatus: string } | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                isActive: true,
                customer: {
                    is: {uuid: customerUuid}
                }
            },
            orderBy: {createdAt: 'desc'},
            select: {
                uuid: true,
                email: true,
                leadStatus: {
                    select: {name: true}
                }
            }
        });

        return lead
            ? {uuid: lead.uuid, email: lead.email, leadStatus: lead.leadStatus.name}
            : undefined;
    }

    async findLatestUuidByMobileNumber(
        mobileNumber: string,
        session?: DatabaseSession
    ): Promise<string | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                isActive: true,
                customer: {
                    is: {mobileNumber}
                }
            },
            orderBy: {createdAt: 'desc'},
            select: {uuid: true}
        });

        return lead?.uuid;
    }

    async findLatestStateByMobileNumber(
        mobileNumber: string,
        session?: DatabaseSession
    ): Promise<{ uuid: string; email: string | null; leadStatus: string } | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                isActive: true,
                customer: {
                    is: {mobileNumber}
                }
            },
            orderBy: {createdAt: 'desc'},
            select: {
                uuid: true,
                email: true,
                leadStatus: {
                    select: {name: true}
                }
            }
        });

        return lead
            ? {uuid: lead.uuid, email: lead.email, leadStatus: lead.leadStatus.name}
            : undefined;
    }

    async findOwnedUuid(
        leadUuid: string,
        customerUuid: string,
        session?: DatabaseSession
    ): Promise<string | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                uuid: leadUuid,
                isActive: true,
                customer: {
                    is: {uuid: customerUuid}
                }
            },
            select: {uuid: true}
        });

        return lead?.uuid;
    }

    async findCustomerIdByLeadUuid(leadUuid: string, session?: DatabaseSession): Promise<bigint | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findUnique({
            where: {uuid: leadUuid},
            select: {customerId: true}
        });

        return lead?.customerId;
    }

    async findIdByLeadUuid(leadUuid: string, session?: DatabaseSession): Promise<bigint | undefined> {
        const client = session?.tx ?? this.prisma;
        const lead = await client.lead.findFirst({
            where: {
                uuid: leadUuid,
                isActive: true
            },
            select: {id: true}
        });

        return lead?.id;
    }

    async updateEmailByUuid(params: {
        leadUuid: string;
        email: string;
        leadStatusId?: number;
        emailVerificationType?: 'GOOGLE' | 'OTP';
    }, session?: DatabaseSession): Promise<void> {
        const client = session?.tx ?? this.prisma;
        await client.lead.updateMany({
            where: {uuid: params.leadUuid},
            data: {
                email: params.email,
                ...(params.leadStatusId !== undefined ? {leadStatusId: params.leadStatusId} : {}),
                ...(params.emailVerificationType !== undefined ? {emailVerificationType: params.emailVerificationType} : {}),
                updatedAt: new Date()
            }
        });
    }

    async markLatestPendingEmailOtpVerifiedByEmail(
        email: string,
        verifiedAt: Date,
        session?: DatabaseSession
    ): Promise<void> {
        const client = session?.tx ?? this.prisma;
        const normalizedEmail = email.trim().toLowerCase();
        const emailOtpType = await client.otpType.findFirst({
            where: {
                isActive: true,
                name: OTP_TYPE.EMAIL
            },
            select: {id: true}
        });

        if (!emailOtpType) {
            return;
        }

        const latestPendingRequest = await client.otpRequest.findFirst({
            where: {
                value: normalizedEmail,
                typeId: emailOtpType.id,
                verifiedAt: null
            },
            orderBy: {createdAt: 'desc'},
            select: {id: true}
        });

        if (!latestPendingRequest) {
            return;
        }

        await client.otpRequest.update({
            where: {id: latestPendingRequest.id},
            data: {verifiedAt}
        });
    }

    async updateStatusByUuid(leadUuid: string, leadStatusId: number, session?: DatabaseSession): Promise<void> {
        const client = session?.tx ?? this.prisma;
        await client.lead.updateMany({
            where: {uuid: leadUuid},
            data: {
                leadStatusId,
                updatedAt: new Date()
            }
        });
    }

    async create(params: {
        uuid: string;
        customerId: bigint;
        leadStatusId: number;
        utmParams?: UtmTrackingParams;
    }, session?: DatabaseSession): Promise<void> {
        const client = session?.tx ?? this.prisma;
        const hasUtmParams = Boolean(
            params.utmParams?.utmSource
            || params.utmParams?.utmMedium
            || params.utmParams?.utmCampaign
            || params.utmParams?.utmTerm
            || params.utmParams?.utmContent
        );

        await client.lead.create({
            data: {
                uuid: params.uuid,
                customerId: params.customerId,
                leadStatusId: params.leadStatusId,
                ...(hasUtmParams
                    ? {
                        leadUtms: {
                            create: {
                                utmSource: params.utmParams?.utmSource ?? null,
                                utmMedium: params.utmParams?.utmMedium ?? null,
                                utmCampaign: params.utmParams?.utmCampaign ?? null,
                                utmTerm: params.utmParams?.utmTerm ?? null,
                                utmContent: params.utmParams?.utmContent ?? null
                            }
                        }
                    }
                    : {})
            }
        });
    }
}
