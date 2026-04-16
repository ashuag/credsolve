import { Injectable } from '@nestjs/common';
import { MailConfigurationException } from '../../mail/exceptions/mail-configuration.exception';
import { MailService } from '../../mail/mail.service';

type SendInvitationParams = {
  email: string;
  fullName: string;
  roleName: string | null;
  invitationLink: string;
  expiresAt: Date;
};

@Injectable()
export class LosUserInvitationService {
  constructor(private readonly mailService: MailService) {}

  async sendInvitation(params: SendInvitationParams) {
    if (!this.mailService.isConfigured()) {
      throw new MailConfigurationException(this.mailService.getMissingConfigurationKeys().join(', '));
    }

    const expiresAtLabel = params.expiresAt.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    const roleLine = params.roleName ? `Assigned role: ${params.roleName}` : 'Assigned role: Pending';

    await this.mailService.send({
      to: params.email,
      subject: 'Complete your MoneyCash LOS registration',
      text: [
        `Hello ${params.fullName},`,
        '',
        'Your MoneyCash LOS account is ready.',
        roleLine,
        '',
        'Use the one-time link below to set your password and complete registration:',
        params.invitationLink,
        '',
        `This link expires on ${expiresAtLabel}.`,
        'If the link has expired, ask your admin to create a new invitation.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #12244f; line-height: 1.6;">
          <p>Hello ${params.fullName},</p>
          <p>Your MoneyCash LOS account is ready.</p>
          <p><strong>${roleLine}</strong></p>
          <p>Use the one-time link below to set your password and complete registration:</p>
          <p style="margin: 22px 0;">
            <a
              href="${params.invitationLink}"
              style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #1496f3; color: #ffffff; text-decoration: none; font-weight: 700;"
            >
              Set password
            </a>
          </p>
          <p style="word-break: break-all; font-size: 13px; color: #5e6782;">${params.invitationLink}</p>
          <p>This link expires on ${expiresAtLabel}.</p>
          <p>If the link has expired, ask your admin to create a new invitation.</p>
        </div>
      `,
    });
  }
}
