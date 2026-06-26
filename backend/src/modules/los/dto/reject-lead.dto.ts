import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RejectLeadDto {
  @ApiProperty({ example: 1, description: 'Master rejection reason id (rejection_reason.id).' })
  @IsInt()
  @Min(1)
  rejectionReasonId!: number;

  @ApiPropertyOptional({ example: 'Income below threshold after manual review.', maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;
}
