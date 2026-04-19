import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LosAuthGuard } from './auth/los-auth.guard';
import type { LosSessionPayload } from './auth/los-session.service';
import { CreateLosRoleDto } from './dto/create-los-role.dto';
import { CreateLosUserDto } from './dto/create-los-user.dto';
import { UpdateLosRoleDto } from './dto/update-los-role.dto';
import { UpdateLosUserDto } from './dto/update-los-user.dto';
import { LosTeamService } from './los-team.service';

type LosRequest = Request & { losUser: LosSessionPayload };

@ApiTags('LOS Team')
@Controller('los')
@UseGuards(LosAuthGuard)
export class LosTeamController {
  constructor(private readonly team: LosTeamService) {}

  @Get('users')
  @ApiOperation({ summary: 'List LOS staff users' })
  listUsers() {
    return this.team.listUsers();
  }

  @Post('users')
  @ApiOperation({ summary: 'Invite a new LOS user' })
  createUser(@Body() dto: CreateLosUserDto) {
    return this.team.createUser(dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update LOS user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateLosUserDto) {
    return this.team.updateUser(id, dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Toggle LOS user active flag' })
  toggleUserStatus(@Req() req: LosRequest, @Param('id') id: string) {
    if (req.losUser.userId === id) {
      throw new BadRequestException('You cannot change your own account status.');
    }
    return this.team.toggleUserStatus(id);
  }

  @Post('users/:id/resend-invitation')
  @ApiOperation({ summary: 'Regenerate invitation for a pending LOS user' })
  resendInvitation(@Param('id') id: string) {
    return this.team.resendInvitation(id);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List LOS roles' })
  listRoles() {
    return this.team.listRoles();
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create LOS role' })
  createRole(@Body() dto: CreateLosRoleDto) {
    return this.team.createRole(dto);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update LOS role' })
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLosRoleDto) {
    return this.team.updateRole(id, dto);
  }

  @Patch('roles/:id/status')
  @ApiOperation({ summary: 'Toggle LOS role active flag' })
  toggleRoleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.team.toggleRoleStatus(id);
  }
}
