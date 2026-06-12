import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PostBureauBreCheckFromHtmlDto {
  @ApiProperty({
    description: 'CIBIL bureau report HTML (myscore.cibil.com / Tenacio export)',
  })
  @IsString()
  @MinLength(32)
  @MaxLength(15_000_000)
  html!: string;

  @ApiPropertyOptional({
    description: 'Original filename for traceability in converted JSON metadata',
    example: 'bureau-report.html',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiPropertyOptional({
    description: 'When true, applies cibil_min_existing instead of cibil_min_new',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isExistingCustomer?: boolean;
}
