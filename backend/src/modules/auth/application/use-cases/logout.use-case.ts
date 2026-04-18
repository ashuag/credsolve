import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CustomerSessionService } from '../../infrastructure/session/customer-session.service';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly customerSessions: CustomerSessionService
  ) {}

  async execute(req: Request, res: Response): Promise<{ success: true }> {
    const settings = await this.settingsRepository.loadAuthOtpSettings();
    const sid = req.cookies?.[settings.authCookieName] as string | undefined;
    await this.customerSessions.revokeSession(sid);
    const secure = isProduction();
    res.clearCookie(settings.authCookieName, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    return { success: true };
  }
}
