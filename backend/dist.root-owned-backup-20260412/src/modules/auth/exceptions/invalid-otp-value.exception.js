"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidOtpValueException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
const otp_constants_1 = require("../../../common/constants/otp.constants");
class InvalidOtpValueException extends app_exception_1.AppException {
    constructor(type) {
        super(common_1.HttpStatus.BAD_REQUEST, type === otp_constants_1.OTP_TYPE.MOBILE ? 'mobile Number is not valid.' : 'email must be a valid email address.', 'INVALID_OTP_VALUE', { type });
    }
}
exports.InvalidOtpValueException = InvalidOtpValueException;
