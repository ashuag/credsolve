import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListVendorApiLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortDir?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  requestMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  httpStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  applicationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  outcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  requestedFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  requestedTo?: string;

  /** Only used by the export endpoint (download link can't set an Authorization header); ignored by list(). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  access_token?: string;
}
