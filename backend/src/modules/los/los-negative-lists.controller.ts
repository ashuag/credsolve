import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LosAuthGuard } from './auth/los-auth.guard';
import type { LosSessionPayload } from './auth/los-session.service';
import { CreateNegativeCityDto } from './dto/create-negative-city.dto';
import { CreateNegativePincodeDto } from './dto/create-negative-pincode.dto';
import { CreateNegativeStateDto } from './dto/create-negative-state.dto';
import { LosDataService } from './los-data.service';

type LosRequest = Request & { losUser: LosSessionPayload };

@ApiTags('LOS Negative Lists')
@Controller('los/negative-lists')
@UseGuards(LosAuthGuard)
export class LosNegativeListsController {
  constructor(private readonly losData: LosDataService) {}

  @Get()
  @ApiOperation({ summary: 'List negative pincodes, cities, and states for LOS' })
  list() {
    return this.losData.getNegativeListsForLos();
  }

  @Post('pincodes')
  @ApiOperation({ summary: 'Add pincode to negative list (or reactivate)' })
  addPincode(@Req() req: LosRequest, @Body() body: CreateNegativePincodeDto) {
    return this.losData.addNegativePincode(req.losUser.userId, body);
  }

  @Delete('pincodes/:id')
  @ApiOperation({ summary: 'Soft-remove pincode from negative list' })
  removePincode(@Req() req: LosRequest, @Param('id', ParseIntPipe) id: number) {
    return this.losData.removeNegativePincode(req.losUser.userId, id);
  }

  @Post('cities')
  @ApiOperation({ summary: 'Add city to negative list (or reactivate)' })
  addCity(@Req() req: LosRequest, @Body() body: CreateNegativeCityDto) {
    return this.losData.addNegativeCity(req.losUser.userId, body);
  }

  @Delete('cities/:id')
  @ApiOperation({ summary: 'Soft-remove city from negative list' })
  removeCity(@Req() req: LosRequest, @Param('id', ParseIntPipe) id: number) {
    return this.losData.removeNegativeCity(req.losUser.userId, id);
  }

  @Post('states')
  @ApiOperation({ summary: 'Add state to negative list (or reactivate)' })
  addState(@Req() req: LosRequest, @Body() body: CreateNegativeStateDto) {
    return this.losData.addNegativeState(req.losUser.userId, body);
  }

  @Delete('states/:id')
  @ApiOperation({ summary: 'Soft-remove state from negative list' })
  removeState(@Req() req: LosRequest, @Param('id', ParseIntPipe) id: number) {
    return this.losData.removeNegativeState(req.losUser.userId, id);
  }
}
