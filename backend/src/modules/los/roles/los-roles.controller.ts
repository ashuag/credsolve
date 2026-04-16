import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosJwtGuard } from '../guards/los-jwt.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { LosRolesService } from './los-roles.service';

@ApiTags('LOS Roles')
@ApiBearerAuth()
@UseGuards(LosJwtGuard)
@Controller('los/roles')
export class LosRolesController {
  constructor(private readonly losRolesService: LosRolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles' })
  findAll() {
    return this.losRolesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'List all active roles' })
  findAllActive() {
    return this.losRolesService.findAllActive();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  create(@Body() dto: CreateRoleDto) {
    return this.losRolesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role name' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.losRolesService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle role active / inactive' })
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.losRolesService.toggleStatus(id);
  }
}
