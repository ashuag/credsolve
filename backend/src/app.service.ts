import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  getStatus() {
    return {
      name: 'MoneyCash backend',
      status: 'ok',
      prisma: this.prismaService.getStatus()
    };
  }
}
