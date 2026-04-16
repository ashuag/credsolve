import { ApiProperty } from '@nestjs/swagger';

export class LookupValueDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Male' })
  name!: string;
}

export class LookupValuesResponseDto {
  @ApiProperty({ type: [LookupValueDto] })
  values!: LookupValueDto[];
}
