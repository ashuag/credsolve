import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RejectPanClientValidationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the customer\'s active lead when omitted.' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;
}
