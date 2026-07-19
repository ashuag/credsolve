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
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';
import { CreateVendorApiConfigDto } from './dto/create-vendor-api-config.dto';
import { UpdateVendorApiConfigDto } from './dto/update-vendor-api-config.dto';
import { LosMasterService } from './services/los-master.service';
import { VendorApiConfigService } from '../../common/vendor/vendor-api-config.service';

@ApiTags('LOS Masters')
@Controller('los/masters')
@UseGuards(LosAuthGuard)
export class LosMastersController {
  constructor(
    private readonly losMaster: LosMasterService,
    private readonly vendorApiConfig: VendorApiConfigService,
  ) {}

  @Get('eligibility-criteria')
  @ApiOperation({ summary: 'List profile eligibility criteria for LOS' })
  eligibilityCriteriaList() {
    return this.losMaster.getEligibilityCriteriaForLos();
  }

  @Patch('eligibility-criteria/:id')
  @ApiOperation({ summary: 'Update eligibility criterion value and/or active flag' })
  eligibilityCriteriaPatch(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateEligibilityCriterionDto) {
    return this.losMaster.updateEligibilityCriterion(id, body);
  }

  @Get('credit-limit-tiers')
  @ApiOperation({ summary: 'List credit limit tiers for LOS' })
  creditLimitTiersList() {
    return this.losMaster.getCreditLimitTiersForLos();
  }

  @Patch('credit-limit-tiers/:id')
  @ApiOperation({ summary: 'Update credit limit tier band and/or active flag' })
  creditLimitTierPatch(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCreditLimitTierDto) {
    return this.losMaster.updateCreditLimitTier(id, body);
  }

  @Post('banks')
  @ApiOperation({ summary: 'Create bank master record' })
  createBank(@Body() body: CreateBankMasterDto) {
    const name = body.name.trim();
    if (!name) {
      throw new BadRequestException('Bank name is required.');
    }
    return this.losMaster.createBank(name);
  }

  @Patch('banks/:id')
  @ApiOperation({ summary: 'Update bank master (name and/or active state)' })
  updateBank(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateBankMasterDto) {
    return this.losMaster.updateBank(id, body);
  }

  @Delete('banks/:id')
  @ApiOperation({ summary: 'Permanently delete bank master record' })
  deleteBank(@Param('id', ParseIntPipe) id: number) {
    return this.losMaster.deleteBank(id);
  }

  @Post('lead-sources')
  @ApiOperation({ summary: 'Create lead source master record' })
  createLeadSource(@Body() body: CreateLeadSourceMasterDto) {
    const name = body.name.trim();
    if (!name) {
      throw new BadRequestException('Lead source name is required.');
    }
    return this.losMaster.createLeadSource({ name, type: body.type });
  }

  @Patch('lead-sources/:id')
  @ApiOperation({ summary: 'Update lead source master (name/type/active state)' })
  updateLeadSource(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateLeadSourceMasterDto) {
    return this.losMaster.updateLeadSource(id, body);
  }

  @Post('source-utms')
  @ApiOperation({ summary: 'Create a source UTM record for a lead source' })
  createSourceUtm(@Body() body: CreateSourceUtmDto) {
    return this.losMaster.createSourceUtm(body);
  }

  @Patch('source-utms/:id')
  @ApiOperation({ summary: 'Update a source UTM record' })
  updateSourceUtm(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSourceUtmDto) {
    return this.losMaster.updateSourceUtm(id, body);
  }

  @Get('sms-templates')
  @ApiOperation({ summary: 'List SMS templates for LOS' })
  smsTemplatesList() {
    return this.losMaster.getSmsTemplatesForLos();
  }

  @Patch('sms-templates/:id')
  @ApiOperation({ summary: 'Update SMS template fields and/or active flag' })
  smsTemplatePatch(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSmsTemplateDto) {
    return this.losMaster.updateSmsTemplate(id, body);
  }

  @Get('vendor-api-configs')
  @ApiOperation({ summary: 'List vendor API configs (primary/backup on/off registry)' })
  async vendorApiConfigsList() {
    const vendorApiConfigs = await this.vendorApiConfig.list();
    return { vendorApiConfigs };
  }

  @Post('vendor-api-configs')
  @ApiOperation({ summary: 'Add a vendor API config row' })
  vendorApiConfigsCreate(@Body() body: CreateVendorApiConfigDto) {
    return this.vendorApiConfig.create(body);
  }

  @Patch('vendor-api-configs/:id')
  @ApiOperation({ summary: 'Update vendor API config (status switch, priority, notes)' })
  vendorApiConfigsPatch(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateVendorApiConfigDto) {
    return this.vendorApiConfig.update(id, body);
  }
}
