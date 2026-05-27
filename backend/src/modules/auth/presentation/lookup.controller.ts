import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';

const CITIES_MAX_LIMIT = 1000;

/**
 * Parses an optional integer query param into a clamped limit.
 * Returns `undefined` (meaning "no limit, keep prior behavior") when the
 * caller didn't pass `?limit=`. Existing customer/LOS clients that expect all
 * active cities continue to work unchanged.
 */
function parseCityLimit(raw?: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, CITIES_MAX_LIMIT);
}

/** Trims and length-caps a free-text search query (defensive against abuse). */
function parseCityQuery(raw?: string): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().slice(0, 64);
  return trimmed.length > 0 ? trimmed : undefined;
}

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

  @Get('reference-relations')
  @ApiOperation({ summary: 'Active reference relation options for customer forms' })
  @ApiOkResponse({ description: 'Lookup rows' })
  async referenceRelations() {
    const values = await this.prisma.client.referenceRelation.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    return { values };
  }

  @Get('cities')
  @ApiOperation({
    summary:
      'Active cities for customer address (label includes state code). Supports optional ?q= search prefix and ?limit= cap.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Case-insensitive substring filter on city name (max 64 chars).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `Max rows to return (no cap by default for backward compat; hard cap ${CITIES_MAX_LIMIT}).`,
  })
  @ApiOkResponse({ description: 'Lookup rows' })
  async cities(@Query('q') q?: string, @Query('limit') limit?: string) {
    const search = parseCityQuery(q);
    const take = parseCityLimit(limit);

    const rows = await this.prisma.client.city.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search } } : {}),
      },
      select: {
        id: true,
        name: true,
        state: { select: { code: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(take !== undefined ? { take } : {}),
    });
    const values = rows.map((r) => ({
      id: r.id,
      name: `${r.name}, ${r.state.code}`,
    }));
    return { values };
  }
}
