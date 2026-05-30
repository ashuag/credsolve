import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosAuthGuard } from './auth/los-auth.guard';
import { CreateBankMasterDto } from './dto/create-bank-master.dto';
import { CreateLeadSourceMasterDto } from './dto/create-lead-source-master.dto';
import { UpdateLeadSourceMasterDto } from './dto/update-lead-source-master.dto';
import { CreateSourceUtmDto } from './dto/create-source-utm.dto';
import { UpdateSourceUtmDto } from './dto/update-source-utm.dto';
import { UpdateBankMasterDto } from './dto/update-bank-master.dto';
import { UpdateEligibilityCriterionDto } from './dto/update-eligibility-criterion.dto';
import { UpdateCreditLimitTierDto } from './dto/update-credit-limit-tier.dto';
import { LosDataService } from './los-data.service';

@ApiTags('LOS Masters')
@Controller('los/masters')
@UseGuards(LosAuthGuard)
export class LosMastersController {
  constructor(private readonly losData: LosDataService) {}

  @Get('eligibility-criteria')
  @ApiOperation({ summary: 'List profile eligibility criteria for LOS' })
  eligibilityCriteriaList() {
    return this.losData.getEligibilityCriteriaForLos();
  }

  @Patch('eligibility-criteria/:id')
  @ApiOperation({ summary: 'Update eligibility criterion value and/or active flag' })
  eligibilityCriteriaPatch(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateEligibilityCriterionDto) {
    return this.losData.updateEligibilityCriterion(id, body);
  }

  @Get('credit-limit-tiers')
  @ApiOperation({ summary: 'List credit limit tiers for LOS' })
  creditLimitTiersList() {
    return this.losData.getCreditLimitTiersForLos();
  }

  @Patch('credit-limit-tiers/:id')
  @ApiOperation({ summary: 'Update credit limit tier band and/or active flag' })
  creditLimitTierPatch(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCreditLimitTierDto) {
    return this.losData.updateCreditLimitTier(id, body);
  }

  @Post('banks')
  @ApiOperation({ summary: 'Create bank master record' })
  createBank(@Body() body: CreateBankMasterDto) {
    const name = body.name.trim();
    if (!name) {
      throw new BadRequestException('Bank name is required.');
    }
    return this.losData.createBank(name);
  }

  @Patch('banks/:id')
  @ApiOperation({ summary: 'Update bank master (name and/or active state)' })
  updateBank(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateBankMasterDto) {
    return this.losData.updateBank(id, body);
  }

  @Delete('banks/:id')
  @ApiOperation({ summary: 'Permanently delete bank master record' })
  deleteBank(@Param('id', ParseIntPipe) id: number) {
    return this.losData.deleteBank(id);
  }

  @Post('lead-sources')
  @ApiOperation({ summary: 'Create lead source master record' })
  createLeadSource(@Body() body: CreateLeadSourceMasterDto) {
    const name = body.name.trim();
    if (!name) {
      throw new BadRequestException('Lead source name is required.');
    }
    return this.losData.createLeadSource({ name, type: body.type });
  }

  @Patch('lead-sources/:id')
  @ApiOperation({ summary: 'Update lead source master (name/type/active state)' })
  updateLeadSource(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateLeadSourceMasterDto) {
    return this.losData.updateLeadSource(id, body);
  }

  @Post('source-utms')
  @ApiOperation({ summary: 'Create a source UTM record for a lead source' })
  createSourceUtm(@Body() body: CreateSourceUtmDto) {
    return this.losData.createSourceUtm(body);
  }

  @Patch('source-utms/:id')
  @ApiOperation({ summary: 'Update a source UTM record' })
  updateSourceUtm(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSourceUtmDto) {
    return this.losData.updateSourceUtm(id, body);
  }
}
