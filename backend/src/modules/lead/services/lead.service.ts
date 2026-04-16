import {randomUUID} from 'node:crypto';
import {BadRequestException, Injectable} from '@nestjs/common';
import {type DatabaseSession} from '../../../../prisma/database-session';
import {type UtmTrackingParams} from '../../../common/types/utm-tracking.types';
import {LeadConfigurationException} from '../exceptions/lead-configuration.exception';
import {LeadRepository} from '../repositories/lead.repository';
import {LeadStatusRepository} from '../repositories/lead-status.repository';

@Injectable()
export class LeadService {
    constructor(
        private readonly leadRepository: LeadRepository,
        private readonly leadStatusRepository: LeadStatusRepository
    ) {
    }

    async ensureForCustomer(
        customerId: bigint,
        utmParams?: UtmTrackingParams,
        session?: DatabaseSession
    ): Promise<{ uuid: string; email: string | null; leadStatus: string } | undefined> {
        const existing = await this.leadRepository.findLatestStateByCustomerId(
            customerId, session
        );

        if (existing) {
            return existing;
        }

        const leadStatusId = await this.leadStatusRepository.findActiveIdByName('NEW', session);

        if (!leadStatusId) {
            throw new LeadConfigurationException('NEW lead status not found — run seeds');
        }

        const uuid = randomUUID();

        await this.leadRepository.create({
            uuid,
            customerId,
            leadStatusId,
            utmParams
        }, session);

        return {uuid, email: null, leadStatus: 'NEW'};
    }

    async findLatestStateForCustomer(
        params: {
            customerUuid: string;
            mobileNumber?: string | null;
        },
        session?: DatabaseSession
    ): Promise<{ uuid: string; email: string | null; leadStatus: string } | undefined> {
        const latestByCustomerUuid = await this.leadRepository.findLatestStateByCustomerUuid(
            params.customerUuid,
            session
        );

        if (latestByCustomerUuid) {
            return latestByCustomerUuid;
        }

        if (!params.mobileNumber) {
            return undefined;
        }

        return this.leadRepository.findLatestStateByMobileNumber(params.mobileNumber, session);
    }

    async updateLeadStatusByUuid(
        leadUuid: string,
        statusName: string,
        session?: DatabaseSession
    ): Promise<void> {
        const statusId = await this.leadStatusRepository.findActiveIdByName(statusName, session);

        if (!statusId) {
            throw new LeadConfigurationException(`${statusName} lead status not found — run seeds`);
        }

        await this.leadRepository.updateStatusByUuid(leadUuid, statusId, session);
    }

    async findCustomerIdByLeadUuid(
        leadUuid: string,
        session?: DatabaseSession
    ): Promise<bigint | undefined> {
        return this.leadRepository.findCustomerIdByLeadUuid(leadUuid, session);
    }

    async findIdByLeadUuid(
        leadUuid: string,
        session?: DatabaseSession
    ): Promise<bigint | undefined> {
        return this.leadRepository.findIdByLeadUuid(leadUuid, session);
    }

    async findLatestUuidByMobileNumber(
        mobileNumber: string,
        session?: DatabaseSession
    ): Promise<string | undefined> {
        return this.leadRepository.findLatestUuidByMobileNumber(mobileNumber, session);
    }

    async resolveLeadUuidForCustomer(
        params: {
            leadUuid?: string;
            customerUuid: string;
            mobileNumber?: string | null;
        },
        session?: DatabaseSession
    ): Promise<string | undefined> {
        if (params.leadUuid) {
            return this.leadRepository.findOwnedUuid(params.leadUuid, params.customerUuid, session);
        }

        if (!params.mobileNumber) {
            return undefined;
        }

        return this.leadRepository.findLatestUuidByMobileNumber(params.mobileNumber, session);
    }

    async syncEmailForCustomer(
        params: {
            customerUuid: string;
            mobileNumber?: string | null;
            leadUuid?: string;
            email: string;
            emailVerified: boolean;
            verificationType?: 'otp' | 'google';
        },
        session?: DatabaseSession
    ): Promise<string | undefined> {
        let leadStatusId: number | undefined;
        let emailVerificationType: 'GOOGLE' | 'OTP' | undefined;

        if (params.emailVerified) {
            const statusId = await this.leadStatusRepository.findActiveIdByName('EMAIL_VERIFIED', session);

            if (!statusId) {
                throw new LeadConfigurationException('EMAIL_VERIFIED lead status not found — run seeds');
            }

            leadStatusId = statusId;
            emailVerificationType = params.verificationType === 'google' ? 'GOOGLE' : 'OTP';
        }

        const resolvedLeadUuid = await this.resolveLeadUuidForCustomer({
            leadUuid: params.leadUuid,
            customerUuid: params.customerUuid,
            mobileNumber: params.mobileNumber
        }, session);

        if (!resolvedLeadUuid) {
            if (params.leadUuid) {
                throw new BadRequestException('Lead reference not found for this account.');
            }

            return undefined;
        }

        await this.leadRepository.updateEmailByUuid({
            leadUuid: resolvedLeadUuid,
            email: params.email,
            leadStatusId,
            emailVerificationType
        }, session);

        if (params.emailVerified && params.verificationType === 'google') {
            await this.leadRepository.markLatestPendingEmailOtpVerifiedByEmail(
                params.email,
                new Date(),
                session
            );
        }

        return resolvedLeadUuid;
    }
}
