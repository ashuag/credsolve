import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ContactService } from './contact.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

function readClientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim();
  }
  return req.ip;
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a message from the public Contact Us form' })
  async submit(@Req() req: Request, @Body() body: CreateContactSubmissionDto) {
    const { uuid } = await this.contact.create(body, {
      ipAddress: readClientIp(req) ?? null,
      userAgent: req.header('user-agent') ?? null,
    });
    return { success: true, uuid };
  }
}
