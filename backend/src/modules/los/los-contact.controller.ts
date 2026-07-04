import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { ContactService } from '../contact/contact.service';
import { LosAuthGuard } from './auth/los-auth.guard';

class UpdateContactReadDto {
  @IsBoolean()
  isRead!: boolean;
}

@ApiTags('LOS Contact Submissions')
@Controller('los/contact-submissions')
@UseGuards(LosAuthGuard)
export class LosContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'List Contact Us form submissions for LOS' })
  list() {
    return this.contact.listForLos();
  }

  @Patch(':uuid/read')
  @ApiOperation({ summary: 'Mark a contact submission as read/unread' })
  markRead(@Param('uuid') uuid: string, @Body() body: UpdateContactReadDto) {
    return this.contact.markRead(uuid, body.isRead);
  }
}
