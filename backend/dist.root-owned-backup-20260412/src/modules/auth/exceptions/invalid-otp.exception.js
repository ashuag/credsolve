"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidOtpException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class InvalidOtpException extends app_exception_1.AppException {
    constructor(remainingAttempts) {
        super(common_1.HttpStatus.BAD_REQUEST, remainingAttempts > 0
            ? 'Invalid OTP. Please try again.'
            : 'Invalid OTP. No attempts remaining for this request.', 'INVALID_OTP', { remainingAttempts });
    }
}
exports.InvalidOtpException = InvalidOtpException;
