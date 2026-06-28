import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectWorkspaceRecordDto {
  @ApiProperty({ example: 'REJECTED_BY_CLIENTS', description: 'Active rejection reason master code (`rejection_reason.name`)' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  rejectionReasonCode!: string;

  @ApiPropertyOptional({ description: 'Ops note stored on the lead (`lead_status_note`)' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  notes?: string;
}
