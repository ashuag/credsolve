import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isVendorApiStatus,
  VENDOR_API_STATUS,
  type VendorApiStatus,
} from '../constants/vendor-api-config.constants';
import { PrismaService } from '../../prisma/prisma.service';

export type VendorApiConfigRow = {
  id: number;
  apiCode: string;
  apiName: string;
  vendorName: string;
  priority: number;
  status: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toRow(row: {
  id: number;
  apiCode: string;
  apiName: string;
  vendorName: string;
  priority: number;
  status: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): VendorApiConfigRow {
  return {
    id: row.id,
    apiCode: row.apiCode,
    apiName: row.apiName,
    vendorName: row.vendorName,
    priority: row.priority,
    status: row.status,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class VendorApiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<VendorApiConfigRow[]> {
    const rows = await this.prisma.client.vendorApiConfig.findMany({
      where: { isActive: true },
      orderBy: [{ apiCode: 'asc' }, { priority: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRow);
  }

  /**
   * Lowest-priority ACTIVE vendor for an API code (primary first).
   * Returns null when none are ACTIVE (or no rows).
   */
  async resolveActive(apiCode: string): Promise<VendorApiConfigRow | null> {
    const rows = await this.listActive(apiCode);
    return rows[0] ?? null;
  }

  /**
   * Primary ACTIVE vendor for an `api_name` (lowest priority first).
   * Used by DigiLocker (`kyc_digilocker`) where selection is by name, not code.
   */
  async resolveActiveByApiName(apiName: string): Promise<VendorApiConfigRow | null> {
    const rows = await this.listActiveByApiName(apiName);
    return rows[0] ?? null;
  }

  /**
   * All ACTIVE vendors for an `api_name` ordered by priority (primary first).
   */
  async listActiveByApiName(apiName: string): Promise<VendorApiConfigRow[]> {
    const name = apiName.trim();
    if (!name) return [];
    const rows = await this.prisma.client.vendorApiConfig.findMany({
      where: {
        apiName: name,
        status: VENDOR_API_STATUS.ACTIVE,
        isActive: true,
      },
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRow);
  }

  /**
   * All ACTIVE vendors for an API code ordered by priority (primary first,
   * then fallbacks). Empty when none are ACTIVE (or no rows).
   */
  async listActive(apiCode: string): Promise<VendorApiConfigRow[]> {
    const code = apiCode.trim().toLowerCase();
    if (!code) return [];
    const rows = await this.prisma.client.vendorApiConfig.findMany({
      where: {
        apiCode: code,
        status: VENDOR_API_STATUS.ACTIVE,
        isActive: true,
      },
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRow);
  }

  async hasAnyForApi(apiCode: string): Promise<boolean> {
    const code = apiCode.trim().toLowerCase();
    if (!code) return false;
    const count = await this.prisma.client.vendorApiConfig.count({
      where: { apiCode: code, isActive: true },
    });
    return count > 0;
  }

  async create(input: {
    apiCode: string;
    apiName: string;
    vendorName: string;
    priority?: number;
    status?: string;
    notes?: string | null;
  }): Promise<VendorApiConfigRow> {
    const apiCode = input.apiCode.trim().toLowerCase();
    const apiName = input.apiName.trim();
    const vendorName = input.vendorName.trim();
    if (!apiCode) throw new BadRequestException('apiCode is required.');
    if (!apiName) throw new BadRequestException('apiName is required.');
    if (!vendorName) throw new BadRequestException('vendorName is required.');

    const priority = input.priority ?? 1;
    if (!Number.isInteger(priority) || priority < 1 || priority > 99) {
      throw new BadRequestException('priority must be an integer from 1 to 99.');
    }

    const statusRaw = (input.status ?? VENDOR_API_STATUS.ACTIVE).trim().toUpperCase();
    if (!isVendorApiStatus(statusRaw)) {
      throw new BadRequestException('status must be ACTIVE or INACTIVE.');
    }
    const status: VendorApiStatus = statusRaw;

    const notes = input.notes?.trim() ? input.notes.trim().slice(0, 255) : null;

    try {
      const row = await this.prisma.client.vendorApiConfig.create({
        data: {
          apiCode,
          apiName,
          vendorName,
          priority,
          status,
          notes,
          isActive: true,
        },
      });
      return toRow(row);
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictException(
          `A vendor API config already exists for apiCode=${apiCode} and vendorName=${vendorName}.`,
        );
      }
      throw err;
    }
  }

  async update(
    id: number,
    patch: {
      apiName?: string;
      priority?: number;
      status?: string;
      notes?: string | null;
      isActive?: boolean;
    },
  ): Promise<VendorApiConfigRow> {
    const existing = await this.prisma.client.vendorApiConfig.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      throw new NotFoundException('Vendor API config not found.');
    }

    const data: {
      apiName?: string;
      priority?: number;
      status?: string;
      notes?: string | null;
      isActive?: boolean;
    } = {};

    if (patch.apiName !== undefined) {
      const trimmed = patch.apiName.trim();
      if (!trimmed) throw new BadRequestException('apiName cannot be empty.');
      data.apiName = trimmed;
    }
    if (patch.priority !== undefined) {
      if (!Number.isInteger(patch.priority) || patch.priority < 1 || patch.priority > 99) {
        throw new BadRequestException('priority must be an integer from 1 to 99.');
      }
      data.priority = patch.priority;
    }
    if (patch.status !== undefined) {
      const statusRaw = patch.status.trim().toUpperCase();
      if (!isVendorApiStatus(statusRaw)) {
        throw new BadRequestException('status must be ACTIVE or INACTIVE.');
      }
      data.status = statusRaw;
    }
    if (patch.notes !== undefined) {
      data.notes = patch.notes?.trim() ? patch.notes.trim().slice(0, 255) : null;
    }
    if (patch.isActive !== undefined) {
      data.isActive = patch.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide apiName, priority, status, notes, and/or isActive to update.');
    }

    const row = await this.prisma.client.vendorApiConfig.update({
      where: { id },
      data,
    });
    return toRow(row);
  }
}
