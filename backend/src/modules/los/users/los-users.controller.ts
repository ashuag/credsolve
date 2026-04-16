import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LosJwtGuard } from '../guards/los-jwt.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LosUsersService } from './los-users.service';

@ApiTags('LOS Users')
@ApiBearerAuth()
@UseGuards(LosJwtGuard)
@Controller('los/users')
export class LosUsersController {
  constructor(private readonly losUsersService: LosUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all LOS agents' })
  findAll() {
    return this.losUsersService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new LOS user' })
  create(@Body() dto: CreateUserDto) {
    return this.losUsersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a LOS user (name, email, role)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.losUsersService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle user active / inactive' })
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.losUsersService.toggleStatus(id);
  }

  @Post(':id/resend-invitation')
  @ApiOperation({ summary: 'Resend the LOS registration email for a pending user' })
  resendInvitation(@Param('id', ParseIntPipe) id: number) {
    return this.losUsersService.resendInvitation(id);
  }
}
