import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SendOtpDto } from '../application/dto/send-otp.dto';
import { VerifyOtpSuccessResponseDto } from '../application/dto/verify-otp-response.dto';
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP for mobile (creates Redis session + Set-Cookie) or email (updates lead email)',
    description:
      'On success, the JSON body always includes `success`, `requestId`, `verified`, and `verifiedAt`. ' +
      'Mobile verification also returns `customerId`, `mobileNumber`, `leadId`, and `leadStatus`. ' +
      'The session identifier is only sent as an HttpOnly `Set-Cookie` (opaque id), never in this JSON body.',
  })
  @ApiOkResponse({
    type: VerifyOtpSuccessResponseDto,
    headers: {
      'Set-Cookie': {
        description:
          'After mobile OTP: HttpOnly cookie (e.g. `mc_sid=<opaque>`) with the Redis-backed session id. Not sent for email-only OTP.',
        schema: { type: 'string' },
      },
    },
  })
  async verifyOtpRoute(@Body() body: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const out = await this.verifyOtpFlow.execute(body, req.customerSession, {
      ip: readClientIp(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
    const { sessionCookie, ...rest } = out;
    if (sessionCookie) {
      res.cookie(sessionCookie.name, sessionCookie.sessionId, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        path: '/',
        maxAge: sessionCookie.maxAgeMs,
      });
    }
    const bodyJson: VerifyOtpSuccessResponseDto = {
      success: rest.success,
      requestId: rest.requestId,
      verified: rest.verified,
      verifiedAt: rest.verifiedAt,
      customerId: rest.customerId,
      mobileNumber: rest.mobileNumber,
      leadId: rest.leadId ?? undefined,
      leadStatus: rest.leadStatus ?? undefined,
    };
    return bodyJson;
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
