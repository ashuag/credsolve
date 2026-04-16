import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosJwtGuard } from '../guards/los-jwt.guard';
import { CreateCityDto } from './dto/create-city.dto';
import { CreateLeadSourceDto } from './dto/create-lead-source.dto';
import { CreateNamedMasterDto } from './dto/create-named-master.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { UpdateLeadSourceDto } from './dto/update-lead-source.dto';
import { UpdateNamedMasterDto } from './dto/update-named-master.dto';
import { UpdateStateDto } from './dto/update-state.dto';
import { UpdateStatusDisplayNameDto } from './dto/update-status-display-name.dto';
import { LosMastersService } from './los-masters.service';

@ApiTags('LOS Masters')
@ApiBearerAuth()
@UseGuards(LosJwtGuard)
@Controller('los/masters')
export class LosMastersController {
  constructor(private readonly losMastersService: LosMastersService) {}

  @Get()
  @ApiOperation({ summary: 'List LOS master data for statuses, sources, locations, occupations, reasons for loan, and genders' })
  getMasters() {
    return this.losMastersService.getMasters();
  }

  @Patch('lead-statuses/:id')
  @ApiOperation({ summary: 'Update lead status display label or active state' })
  updateLeadStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDisplayNameDto) {
    return this.losMastersService.updateLeadStatus(id, dto);
  }

  @Patch('application-statuses/:id')
  @ApiOperation({ summary: 'Update application status display label or active state' })
  updateApplicationStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDisplayNameDto) {
    return this.losMastersService.updateApplicationStatus(id, dto);
  }

  @Post('lead-sources')
  @ApiOperation({ summary: 'Create a lead source' })
  createLeadSource(@Body() dto: CreateLeadSourceDto) {
    return this.losMastersService.createLeadSource(dto);
  }

  @Patch('lead-sources/:id')
  @ApiOperation({ summary: 'Update or soft delete a lead source' })
  updateLeadSource(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeadSourceDto) {
    return this.losMastersService.updateLeadSource(id, dto);
  }

  @Post('states')
  @ApiOperation({ summary: 'Create a state' })
  createState(@Body() dto: CreateStateDto) {
    return this.losMastersService.createState(dto);
  }

  @Patch('states/:id')
  @ApiOperation({ summary: 'Update or soft delete a state' })
  updateState(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStateDto) {
    return this.losMastersService.updateState(id, dto);
  }

  @Post('cities')
  @ApiOperation({ summary: 'Create a city' })
  createCity(@Body() dto: CreateCityDto) {
    return this.losMastersService.createCity(dto);
  }

  @Patch('cities/:id')
  @ApiOperation({ summary: 'Update or soft delete a city' })
  updateCity(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCityDto) {
    return this.losMastersService.updateCity(id, dto);
  }

  @Post('occupations')
  @ApiOperation({ summary: 'Create an occupation' })
  createOccupation(@Body() dto: CreateNamedMasterDto) {
    return this.losMastersService.createOccupation(dto);
  }

  @Patch('occupations/:id')
  @ApiOperation({ summary: 'Update or soft delete an occupation' })
  updateOccupation(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNamedMasterDto) {
    return this.losMastersService.updateOccupation(id, dto);
  }

  @Post('reasons-for-loan')
  @ApiOperation({ summary: 'Create a reason for loan' })
  createReasonForLoan(@Body() dto: CreateNamedMasterDto) {
    return this.losMastersService.createReasonForLoan(dto);
  }

  @Patch('reasons-for-loan/:id')
  @ApiOperation({ summary: 'Update or soft delete a reason for loan' })
  updateReasonForLoan(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNamedMasterDto) {
    return this.losMastersService.updateReasonForLoan(id, dto);
  }

  @Post('genders')
  @ApiOperation({ summary: 'Create a gender' })
  createGender(@Body() dto: CreateNamedMasterDto) {
    return this.losMastersService.createGender(dto);
  }

  @Patch('genders/:id')
  @ApiOperation({ summary: 'Update or soft delete a gender' })
  updateGender(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNamedMasterDto) {
    return this.losMastersService.updateGender(id, dto);
  }

  // ── Eligibility Criteria ────────────────────────────────────────────────────

  @Get('eligibility-criteria')
  @ApiOperation({ summary: 'List all eligibility criteria' })
  getEligibilityCriteria() {
    return this.losMastersService.getEligibilityCriteria();
  }

  @Patch('eligibility-criteria/:id')
  @ApiOperation({ summary: 'Update an eligibility criterion value or active state' })
  updateEligibilityCriterion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { value?: string; isActive?: boolean },
  ) {
    return this.losMastersService.updateEligibilityCriterion(id, dto);
  }

  // ── Credit Limit Tiers ──────────────────────────────────────────────────────

  @Get('credit-limit-tiers')
  @ApiOperation({ summary: 'List all credit limit tiers (Eligibility Basis table)' })
  getCreditLimitTiers() {
    return this.losMastersService.getCreditLimitTiers();
  }

  @Patch('credit-limit-tiers/:id')
  @ApiOperation({ summary: 'Update a credit limit tier' })
  updateCreditLimitTier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { minUnsecuredLoan?: number; maxUnsecuredLoan?: number | null; maxBulletLoan?: number; sortOrder?: number; isActive?: boolean },
  ) {
    return this.losMastersService.updateCreditLimitTier(id, dto);
  }
}
