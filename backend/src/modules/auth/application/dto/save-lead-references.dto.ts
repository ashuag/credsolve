import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export class LeadReferenceInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Length(10, 10)
  @Matches(INDIAN_MOBILE)
  mobileNumber!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  relationId!: number;
}

export class SaveLeadReferencesDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  leadUuid?: string;

  @ApiProperty({ type: [LeadReferenceInputDto], minItems: 2, maxItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => LeadReferenceInputDto)
  references!: LeadReferenceInputDto[];
}
