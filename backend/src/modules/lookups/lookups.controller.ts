import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LookupValuesResponseDto } from './dto/outputDto/lookup-values-response.dto';
import { LookupsService } from './lookups.service';

@ApiTags('Lookups')
@Controller('lookup')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @ApiOperation({ summary: 'Get active gender values' })
  @ApiOkResponse({ type: LookupValuesResponseDto })
  @Get('gender')
  getGenders() {
    return this.lookupsService.getGenders();
  }

  @ApiOperation({ summary: 'Get active occupation values' })
  @ApiOkResponse({ type: LookupValuesResponseDto })
  @Get('occupations')
  getOccupations() {
    return this.lookupsService.getOccupations();
  }

  @ApiOperation({ summary: 'Get active city values' })
  @ApiOkResponse({ type: LookupValuesResponseDto })
  @Get('cities')
  getCities() {
    return this.lookupsService.getCities();
  }
}
