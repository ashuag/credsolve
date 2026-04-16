import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LosAuthService } from './los-auth.service';
import { LosLoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@ApiTags('LOS Auth')
@Controller('los/auth')
export class LosAuthController {
  constructor(private readonly losAuthService: LosAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for LOS/CRM staff' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LosLoginDto) {
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
}
