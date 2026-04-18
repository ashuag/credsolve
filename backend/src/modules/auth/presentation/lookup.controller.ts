import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('lookup')
@Controller('lookup')
export class LookupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('gender')
  @ApiOperation({ summary: 'Active gender options for customer forms' })
  @ApiOkResponse({
    description: 'Lookup rows',
    schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' } } },
        },
      },
    },
  })
  async gender() {
    const values = await this.prisma.client.gender.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    return { values };
  }

  @Get('occupations')
  @ApiOperation({ summary: 'Active occupation options for customer forms' })
  @ApiOkResponse({ description: 'Lookup rows' })
  async occupations() {
    const values = await this.prisma.client.occupation.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    return { values };
  }

  @Get('cities')
  @ApiOperation({
    summary: 'Active cities for customer address (label includes state code for disambiguation)',
  })
  @ApiOkResponse({ description: 'Lookup rows' })
  async cities() {
    const rows = await this.prisma.client.city.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        state: { select: { code: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const values = rows.map((r) => ({
      id: r.id,
      name: `${r.name}, ${r.state.code}`,
    }));
    return { values };
  }
}
