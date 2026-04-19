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
}
