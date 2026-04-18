import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SendOtpDto } from '../application/dto/send-otp.dto';
import { VerifyOtpDto } from '../application/dto/verify-otp.dto';
import { GetCustomerSessionUseCase } from '../application/use-cases/get-customer-session.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { SendOtpUseCase } from '../application/use-cases/send-otp.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';
import { OptionalCustomerSessionGuard } from './guards/optional-customer-session.guard';

function readClientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim();
  }
  return req.ip;
}

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

@ApiTags('auth')
@Controller('auth')
@UseGuards(OptionalCustomerSessionGuard)
export class AuthController {
  constructor(
    private readonly sendOtpFlow: SendOtpUseCase,
    private readonly verifyOtpFlow: VerifyOtpUseCase,
    private readonly customerSession: GetCustomerSessionUseCase,
    private readonly logoutFlow: LogoutUseCase
  ) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send OTP to mobile or email (email requires an existing mobile session)' })
  sendOtpRoute(@Body() body: SendOtpDto, @Req() req: Request) {
    return this.sendOtpFlow.execute(body, readClientIp(req), req.customerSession);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP for mobile (creates session) or email (updates lead email)' })
  async verifyOtpRoute(@Body() body: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.verifyOtpFlow.execute(body, req.customerSession, {
      ip: readClientIp(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    const { sessionCookie, ...json } = out;
    if (sessionCookie) {
      res.cookie(sessionCookie.name, sessionCookie.sessionId, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        path: '/',
        maxAge: sessionCookie.maxAgeMs,
      });
    }
    return json;
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the current customer session if the auth cookie is valid' })
  me(@Req() req: Request) {
    return this.customerSession.execute(req);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke server-side session and clear the auth cookie' })
  logoutRoute(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.logoutFlow.execute(req, res);
  }
}
