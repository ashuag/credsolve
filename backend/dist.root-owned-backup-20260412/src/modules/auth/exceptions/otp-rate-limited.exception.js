"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpRateLimitedException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpRateLimitedException extends app_exception_1.AppException {
    constructor(retryAfterSeconds) {
        super(common_1.HttpStatus.TOO_MANY_REQUESTS, 'Too many attempts. Try again after some times.', 'OTP_RATE_LIMITED', { retryAfterSeconds });
    }
}
exports.OtpRateLimitedException = OtpRateLimitedException;
