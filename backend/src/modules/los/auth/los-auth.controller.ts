import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LosLoginDto } from './dto/login.dto';
import { LosAuthService } from './los-auth.service';
import { LosAuthGuard } from './los-auth.guard';
import { UpdatePasswordDto } from './dto/update-password.dto';

@ApiTags('LOS Auth')
@Controller('los/auth')
export class LosAuthController {
  constructor(private readonly losAuthService: LosAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for LOS staff users' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LosLoginDto) {
    return this.losAuthService.login(dto);
  }

  @Get('invitations/:token')
  @ApiOperation({ summary: 'Validate a LOS invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation token is valid' })
  @ApiResponse({ status: 410, description: 'Invitation link has expired' })
  getInvitation(@Param('token') token: string) {
    return this.losAuthService.getInvitation(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the initial password for a LOS invitation' })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  @ApiResponse({ status: 410, description: 'Invitation link has expired' })
  acceptInvitation(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.losAuthService.acceptInvitation(token, dto);
  }

  @Patch('password')
  @UseGuards(LosAuthGuard)
  @ApiOperation({ summary: 'Update password for authenticated LOS user' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  updatePassword(@Req() req: Request & { losUser?: { userId: string } }, @Body() dto: UpdatePasswordDto) {
    return this.losAuthService.updatePassword(req.losUser!.userId, dto);
  }
}
