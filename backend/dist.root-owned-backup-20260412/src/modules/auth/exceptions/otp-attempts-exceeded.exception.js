"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpAttemptsExceededException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpAttemptsExceededException extends app_exception_1.AppException {
    constructor() {
        super(common_1.HttpStatus.TOO_MANY_REQUESTS, 'Too many invalid OTP attempts. Please request a fresh OTP.', 'OTP_ATTEMPTS_EXCEEDED');
    }
}
exports.OtpAttemptsExceededException = OtpAttemptsExceededException;
