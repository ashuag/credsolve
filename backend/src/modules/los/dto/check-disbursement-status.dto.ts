import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Request body for the LOS developer check-disbursement-status tool. */
export class CheckDisbursementStatusDto {
  @ApiPropertyOptional({
    example: 'APP2026TSVP8,APP2026ABCD1',
    description:
      'One or more application numbers or UUIDs, comma-separated, no spaces. When set, date range is ignored.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  @Matches(/^\S+$/, { message: 'Application IDs must be comma-separated with no spaces.' })
  applicationNumber?: string;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Inclusive disbursed-at start (YYYY-MM-DD, IST).' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-08-29', description: 'Inclusive disbursed-at end (YYYY-MM-DD, IST).' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
