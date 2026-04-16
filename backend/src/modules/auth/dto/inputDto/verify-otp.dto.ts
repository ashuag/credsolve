import {Transform} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';
import { IsEnum, IsString, Matches } from 'class-validator';
import {OTP_TYPE, type OtpType} from '../../../../common/constants/otp.constants';

export class VerifyOtpDto {
    @ApiProperty({enum: OTP_TYPE, example: OTP_TYPE.MOBILE})
    @Transform(({value}) => {
        if (typeof value === 'string') {
            return value.trim().toLowerCase();
        }

        return value;
    })
    @IsEnum(OTP_TYPE)
    type!: OtpType;

    @ApiProperty({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' })
    @Transform(({value}) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
        message: 'requestId must be a valid OTP request uuid.'
    })
    requestId!: string;

    @ApiProperty({example: '649756'})
    @Transform(({value}) => (typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : value))
    @IsString()
    @Matches(/^\d{6}$/, {message: 'otpCode must be a 6-digit OTP.'})
    otpCode!: string;
}
