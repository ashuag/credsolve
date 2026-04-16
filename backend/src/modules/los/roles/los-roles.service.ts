import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class LosRolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.userRole.findMany({
      orderBy: [{ hierarchyLevel: 'asc' }, { id: 'asc' }],
    });
  }

  findAllActive() {
    return this.prisma.userRole.findMany({
      where: { isActive: true },
      orderBy: [{ hierarchyLevel: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateRoleDto) {
    // MySQL VARCHAR comparisons are case-insensitive by default (utf8mb4 collation)
    const existing = await this.prisma.userRole.findFirst({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('A role with this name already exists');
    this.validateHierarchy(dto.name, dto.hierarchyLevel);

    return this.prisma.userRole.create({
      data: {
        name: dto.name,
        hierarchyLevel: dto.hierarchyLevel,
        isActive: true,
      },
    });
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.findOne(id);

    if (dto.name) {
      const duplicate = await this.prisma.userRole.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (duplicate) throw new ConflictException('A role with this name already exists');
    }

    const nextName = dto.name ?? role.name;
    const nextHierarchyLevel = dto.hierarchyLevel ?? role.hierarchyLevel;
    this.validateHierarchy(nextName, nextHierarchyLevel);

    return this.prisma.userRole.update({ where: { id }, data: dto });
  }

  async toggleStatus(id: number) {
    const role = await this.findOne(id);
    return this.prisma.userRole.update({ where: { id }, data: { isActive: !role.isActive } });
  }

  private async findOne(id: number) {
    const role = await this.prisma.userRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role #${id} not found`);
    return role;
  }

  private validateHierarchy(name: string, hierarchyLevel: number) {
    const normalizedName = name.trim().toUpperCase();

    if (normalizedName === 'ADMIN' && hierarchyLevel !== 1) {
      throw new BadRequestException('ADMIN must remain at hierarchy level 1.');
    }

    if (normalizedName !== 'ADMIN' && hierarchyLevel === 1) {
      throw new BadRequestException('Hierarchy level 1 is reserved for ADMIN.');
    }
  }
}
