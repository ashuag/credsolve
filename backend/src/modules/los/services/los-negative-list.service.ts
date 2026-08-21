import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateNegativeCityDto } from '../dto/create-negative-city.dto';
import type { CreateNegativePincodeDto } from '../dto/create-negative-pincode.dto';
import type { CreateNegativeStateDto } from '../dto/create-negative-state.dto';

type LosAuditUser = { id: string; fullName: string; email: string } | null;

const negativeListUserSelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

const negativePincodeInclude = {
  negativeAddedBy: { select: negativeListUserSelect },
  negativeRemovedBy: { select: negativeListUserSelect },
  city: { include: { state: true } },
} as const;

const negativeCityInclude = {
  state: true,
  negativeAddedBy: { select: negativeListUserSelect },
  negativeRemovedBy: { select: negativeListUserSelect },
} as const;

const negativeStateInclude = {
  negativeAddedBy: { select: negativeListUserSelect },
  negativeRemovedBy: { select: negativeListUserSelect },
} as const;

@Injectable()
export class LosNegativeListService {
  constructor(private readonly prisma: PrismaService) {}

  private mapAuditUser(
    user: { id: bigint; fullName: string; email: string } | null | undefined,
  ): LosAuditUser {
    if (!user) return null;
    return {
      id: user.id.toString(),
      fullName: user.fullName,
      email: user.email,
    };
  }

  private mapNegativePincode(row: {
    id: number;
    code: string;
    negativeReason: string | null;
    isNegative: boolean;
    negativeAddedAt: Date | null;
    negativeRemovedAt: Date | null;
    city: { name: string; state: { name: string; code: string } };
    negativeAddedBy: { id: bigint; fullName: string; email: string } | null;
    negativeRemovedBy: { id: bigint; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      pincode: row.code,
      cityName: row.city.name,
      stateName: row.city.state.name,
      stateCode: row.city.state.code,
      reason: row.negativeReason,
      isActive: row.isNegative,
      addedAt: row.negativeAddedAt?.toISOString() ?? null,
      removedAt: row.negativeRemovedAt?.toISOString() ?? null,
      addedBy: this.mapAuditUser(row.negativeAddedBy),
      removedBy: this.mapAuditUser(row.negativeRemovedBy),
    };
  }

  private mapNegativeCity(row: {
    id: number;
    name: string;
    negativeReason: string | null;
    isNegative: boolean;
    negativeAddedAt: Date | null;
    negativeRemovedAt: Date | null;
    state: { name: string; code: string };
    negativeAddedBy: { id: bigint; fullName: string; email: string } | null;
    negativeRemovedBy: { id: bigint; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      cityId: row.id,
      cityName: row.name,
      stateName: row.state.name,
      stateCode: row.state.code,
      reason: row.negativeReason,
      isActive: row.isNegative,
      addedAt: row.negativeAddedAt?.toISOString() ?? null,
      removedAt: row.negativeRemovedAt?.toISOString() ?? null,
      addedBy: this.mapAuditUser(row.negativeAddedBy),
      removedBy: this.mapAuditUser(row.negativeRemovedBy),
    };
  }

  private mapNegativeState(row: {
    id: number;
    name: string;
    code: string;
    negativeReason: string | null;
    isNegative: boolean;
    negativeAddedAt: Date | null;
    negativeRemovedAt: Date | null;
    negativeAddedBy: { id: bigint; fullName: string; email: string } | null;
    negativeRemovedBy: { id: bigint; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      stateId: row.id,
      stateName: row.name,
      stateCode: row.code,
      reason: row.negativeReason,
      isActive: row.isNegative,
      addedAt: row.negativeAddedAt?.toISOString() ?? null,
      removedAt: row.negativeRemovedAt?.toISOString() ?? null,
      addedBy: this.mapAuditUser(row.negativeAddedBy),
      removedBy: this.mapAuditUser(row.negativeRemovedBy),
    };
  }

  private parseLosUserId(userId: string): bigint {
    try {
      return BigInt(userId);
    } catch {
      throw new BadRequestException('Invalid LOS user session.');
    }
  }

  async getNegativeListsForLos() {
    const negativeFilter = { OR: [{ isNegative: true }, { negativeRemovedAt: { not: null } }] };

    const [pincodes, cities, states] = await Promise.all([
      this.prisma.read.pincode.findMany({
        where: negativeFilter,
        include: negativePincodeInclude,
        orderBy: [{ isNegative: 'desc' }, { negativeAddedAt: 'desc' }],
      }),
      this.prisma.read.city.findMany({
        where: negativeFilter,
        include: negativeCityInclude,
        orderBy: [{ isNegative: 'desc' }, { negativeAddedAt: 'desc' }],
      }),
      this.prisma.read.state.findMany({
        where: negativeFilter,
        include: negativeStateInclude,
        orderBy: [{ isNegative: 'desc' }, { negativeAddedAt: 'desc' }],
      }),
    ]);

    return {
      pincodes: pincodes.map((row) => this.mapNegativePincode(row)),
      cities: cities.map((row) => this.mapNegativeCity(row)),
      states: states.map((row) => this.mapNegativeState(row)),
    };
  }

  async addNegativePincode(userId: string, dto: CreateNegativePincodeDto) {
    const code = dto.pincode.trim();
    const negativeAddedByUserId = this.parseLosUserId(userId);
    const negativeReason = dto.reason?.trim() || null;

    const existing = await this.prisma.client.pincode.findUnique({
      where: { code },
      include: negativePincodeInclude,
    });

    if (!existing) {
      throw new NotFoundException('Pincode not found in the pincode master.');
    }

    if (existing.isNegative) {
      throw new ConflictException('This pincode is already on the negative list.');
    }

    const row = await this.prisma.client.pincode.update({
      where: { id: existing.id },
      data: {
        isNegative: true,
        negativeReason,
        negativeAddedByUserId,
        negativeAddedAt: new Date(),
        negativeRemovedByUserId: null,
        negativeRemovedAt: null,
      },
      include: negativePincodeInclude,
    });
    return this.mapNegativePincode(row);
  }

  async removeNegativePincode(userId: string, id: number) {
    const negativeRemovedByUserId = this.parseLosUserId(userId);
    const existing = await this.prisma.client.pincode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Pincode not found.');
    }
    if (!existing.isNegative) {
      throw new BadRequestException('This pincode is not on the negative list.');
    }

    const row = await this.prisma.client.pincode.update({
      where: { id },
      data: {
        isNegative: false,
        negativeRemovedByUserId,
        negativeRemovedAt: new Date(),
      },
      include: negativePincodeInclude,
    });
    return this.mapNegativePincode(row);
  }

  async addNegativeCity(userId: string, dto: CreateNegativeCityDto) {
    const negativeAddedByUserId = this.parseLosUserId(userId);
    const negativeReason = dto.reason?.trim() || null;

    const existing = await this.prisma.client.city.findUnique({
      where: { id: dto.cityId },
      include: negativeCityInclude,
    });

    if (!existing) {
      throw new NotFoundException('City not found.');
    }

    if (existing.isNegative) {
      throw new ConflictException('This city is already on the negative list.');
    }

    const row = await this.prisma.client.city.update({
      where: { id: dto.cityId },
      data: {
        isNegative: true,
        negativeReason,
        negativeAddedByUserId,
        negativeAddedAt: new Date(),
        negativeRemovedByUserId: null,
        negativeRemovedAt: null,
      },
      include: negativeCityInclude,
    });
    return this.mapNegativeCity(row);
  }

  async removeNegativeCity(userId: string, id: number) {
    const negativeRemovedByUserId = this.parseLosUserId(userId);
    const existing = await this.prisma.client.city.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('City not found.');
    }
    if (!existing.isNegative) {
      throw new BadRequestException('This city is not on the negative list.');
    }

    const row = await this.prisma.client.city.update({
      where: { id },
      data: {
        isNegative: false,
        negativeRemovedByUserId,
        negativeRemovedAt: new Date(),
      },
      include: negativeCityInclude,
    });
    return this.mapNegativeCity(row);
  }

  async addNegativeState(userId: string, dto: CreateNegativeStateDto) {
    const negativeAddedByUserId = this.parseLosUserId(userId);
    const negativeReason = dto.reason?.trim() || null;

    const existing = await this.prisma.client.state.findUnique({
      where: { id: dto.stateId },
      include: negativeStateInclude,
    });

    if (!existing) {
      throw new NotFoundException('State not found.');
    }

    if (existing.isNegative) {
      throw new ConflictException('This state is already on the negative list.');
    }

    const row = await this.prisma.client.state.update({
      where: { id: dto.stateId },
      data: {
        isNegative: true,
        negativeReason,
        negativeAddedByUserId,
        negativeAddedAt: new Date(),
        negativeRemovedByUserId: null,
        negativeRemovedAt: null,
      },
      include: negativeStateInclude,
    });
    return this.mapNegativeState(row);
  }

  async removeNegativeState(userId: string, id: number) {
    const negativeRemovedByUserId = this.parseLosUserId(userId);
    const existing = await this.prisma.client.state.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('State not found.');
    }
    if (!existing.isNegative) {
      throw new BadRequestException('This state is not on the negative list.');
    }

    const row = await this.prisma.client.state.update({
      where: { id },
      data: {
        isNegative: false,
        negativeRemovedByUserId,
        negativeRemovedAt: new Date(),
      },
      include: negativeStateInclude,
    });
    return this.mapNegativeState(row);
  }
}
