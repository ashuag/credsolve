import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePanNsdlCacheIdentity } from './pan-nsdl-cache.util';

export type PanNsdlCacheRow = {
  id: bigint;
  uuid: string;
  panNumber: string;
  fullName: string;
  dateOfBirth: Date;
  nsdlResponse: Prisma.JsonValue;
  nameVerified: boolean;
  vendorRequestId: string | null;
};

@Injectable()
export class PanNsdlCacheRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: bigint): Promise<PanNsdlCacheRow | null> {
    return this.prisma.client.panNsdlCache.findUnique({
      where: { id },
      select: {
        id: true,
        uuid: true,
        panNumber: true,
        fullName: true,
        dateOfBirth: true,
        nsdlResponse: true,
        nameVerified: true,
        vendorRequestId: true,
      },
    });
  }

  findByIdentity(input: {
    panNumber: string;
    fullName: string;
    dateOfBirth: Date;
  }): Promise<PanNsdlCacheRow | null> {
    const identity = normalizePanNsdlCacheIdentity(input);
    return this.prisma.client.panNsdlCache.findUnique({
      where: {
        panNumber_dateOfBirth_fullName: identity,
      },
      select: {
        id: true,
        uuid: true,
        panNumber: true,
        fullName: true,
        dateOfBirth: true,
        nsdlResponse: true,
        nameVerified: true,
        vendorRequestId: true,
      },
    });
  }

  upsertVerifiedIdentity(input: {
    panNumber: string;
    fullName: string;
    dateOfBirth: Date;
    nsdlResponse: Prisma.InputJsonValue;
    nameVerified: boolean;
    vendorRequestId: string | null;
  }): Promise<PanNsdlCacheRow> {
    const identity = normalizePanNsdlCacheIdentity(input);
    const vendorRequestId = input.vendorRequestId?.slice(0, 128) || null;
    const verifiedAt = new Date();
    return this.prisma.client.panNsdlCache.upsert({
      where: { panNumber_dateOfBirth_fullName: identity },
      create: {
        ...identity,
        nsdlResponse: input.nsdlResponse,
        nameVerified: input.nameVerified,
        vendorRequestId,
        verifiedAt,
      },
      update: {
        nsdlResponse: input.nsdlResponse,
        nameVerified: input.nameVerified,
        vendorRequestId,
        verifiedAt,
      },
      select: {
        id: true,
        uuid: true,
        panNumber: true,
        fullName: true,
        dateOfBirth: true,
        nsdlResponse: true,
        nameVerified: true,
        vendorRequestId: true,
      },
    });
  }

  attachToCustomer(customerId: bigint, panNsdlCacheId: bigint): Promise<unknown> {
    return this.prisma.client.customer.update({
      where: { id: customerId },
      data: { panNsdlCacheId },
      select: { id: true },
    });
  }
}
