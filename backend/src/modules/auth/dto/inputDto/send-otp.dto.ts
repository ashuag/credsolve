import {Transform} from 'class-transformer';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsDefined, IsEnum, IsOptional, IsString, MaxLength} from 'class-validator';
import {OTP_TYPE, type OtpType} from '../../../../common/constants/otp.constants';

function normalizeOptionalUtmValue(value: unknown) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class SendOtpDto {
    @ApiProperty({enum: OTP_TYPE, example: OTP_TYPE.MOBILE})
    @Transform(({value}) => {
        if (typeof value === 'string') {
            return value.trim().toLowerCase();
        }

        return value;
    })
    @IsEnum(OTP_TYPE)
    type!: OtpType;

    @ApiProperty({
        oneOf: [
            {type: 'integer', example: 8882911939},
            {type: 'string', example: 'saurabh@gmail.com'}
        ]
    })
    @IsDefined()
    value!: string | number;

    @ApiPropertyOptional({description: 'Optional UTM source value for attribution.'})
    @Transform(({value}) => normalizeOptionalUtmValue(value))
    @IsOptional()
    @IsString()
    @MaxLength(100)
    utmSource?: string;

    @ApiPropertyOptional({description: 'Optional UTM medium value for attribution.'})
    @Transform(({value}) => normalizeOptionalUtmValue(value))
    @IsOptional()
    @IsString()
    @MaxLength(100)
    utmMedium?: string;

    @ApiPropertyOptional({description: 'Optional UTM campaign value for attribution.'})
    @Transform(({value}) => normalizeOptionalUtmValue(value))
    @IsOptional()
    @IsString()
    @MaxLength(100)
    utmCampaign?: string;

    @ApiPropertyOptional({description: 'Optional UTM term value for attribution.'})
    @Transform(({value}) => normalizeOptionalUtmValue(value))
    @IsOptional()
    @IsString()
    @MaxLength(100)
    utmTerm?: string;

    @ApiPropertyOptional({description: 'Optional UTM content value for attribution.'})
    @Transform(({value}) => normalizeOptionalUtmValue(value))
    @IsOptional()
    @IsString()
    @MaxLength(100)
    utmContent?: string;
}
