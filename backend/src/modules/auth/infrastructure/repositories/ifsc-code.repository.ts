import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IfscCodeFields } from '../../../../common/ifsc/ifsc-code.util';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class IfscCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIfscCode(ifscCode: string) {
    return this.prisma.client.ifscCode.findUnique({
      where: { ifscCode },
    });
  }

  upsertFromLookup(fields: IfscCodeFields) {
    const payload = fields.apiPayload as Prisma.InputJsonValue;
    const data = {
      bankName: fields.bankName,
      address: fields.address,
      city: fields.city,
      state: fields.state,
      pincode: fields.pincode,
      apiPayload: payload,
    };
    return this.prisma.client.ifscCode.upsert({
      where: { ifscCode: fields.ifscCode },
      create: { ifscCode: fields.ifscCode, ...data },
      update: data,
    });
  }
}
