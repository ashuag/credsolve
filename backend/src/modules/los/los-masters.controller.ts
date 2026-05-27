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
import { CreateUtmCampaignDto } from './dto/create-utm-campaign.dto';
import { CreateUtmMediumDto } from './dto/create-utm-medium.dto';
import { CreateUtmSourceDto } from './dto/create-utm-source.dto';
import { UpdateLeadSourceMasterDto } from './dto/update-lead-source-master.dto';
import { UpdateUtmCampaignDto } from './dto/update-utm-campaign.dto';
import { UpdateUtmMediumDto } from './dto/update-utm-medium.dto';
import { UpdateUtmSourceDto } from './dto/update-utm-source.dto';
import { UpdateBankMasterDto } from './dto/update-bank-master.dto';
import { UpdateEligibilityCriterionDto } from './dto/update-eligibility-criterion.dto';
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

  @Post('utm-sources')
  @ApiOperation({ summary: 'Create UTM source tag for a lead source' })
  createUtmSource(@Body() body: CreateUtmSourceDto) {
    return this.losData.createUtmSource({
      leadSourceId: body.leadSourceId,
      name: body.name.trim(),
    });
  }

  @Patch('utm-sources/:id')
  @ApiOperation({ summary: 'Update UTM source tag' })
  updateUtmSource(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUtmSourceDto) {
    return this.losData.updateUtmSource(id, body);
  }

  @Post('utm-mediums')
  @ApiOperation({ summary: 'Create UTM medium tag for a lead source' })
  createUtmMedium(@Body() body: CreateUtmMediumDto) {
    return this.losData.createUtmMedium({
      leadSourceId: body.leadSourceId,
      name: body.name.trim(),
    });
  }

  @Patch('utm-mediums/:id')
  @ApiOperation({ summary: 'Update UTM medium tag' })
  updateUtmMedium(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUtmMediumDto) {
    return this.losData.updateUtmMedium(id, body);
  }

  @Post('utm-campaigns')
  @ApiOperation({ summary: 'Create UTM campaign tag for a lead source' })
  createUtmCampaign(@Body() body: CreateUtmCampaignDto) {
    return this.losData.createUtmCampaign({
      leadSourceId: body.leadSourceId,
      name: body.name.trim(),
    });
  }

  @Patch('utm-campaigns/:id')
  @ApiOperation({ summary: 'Update UTM campaign tag' })
  updateUtmCampaign(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUtmCampaignDto) {
    return this.losData.updateUtmCampaign(id, body);
  }
}
