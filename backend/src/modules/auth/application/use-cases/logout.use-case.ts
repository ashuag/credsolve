import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CustomerSessionService } from '../../infrastructure/session/customer-session.service';
import { buildCustomerAuthCookieClearOptions } from '../../infrastructure/session/customer-auth-cookie.util';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

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
    res.clearCookie(settings.authCookieName, buildCustomerAuthCookieClearOptions());
    return { success: true };
  }
}
