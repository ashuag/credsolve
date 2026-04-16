"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpResendTooSoonException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpResendTooSoonException extends app_exception_1.AppException {
    constructor() {
        super(common_1.HttpStatus.TOO_MANY_REQUESTS, `Too many request, please try after some times.`, 'OTP_RESEND_TOO_SOON');
    }
}
exports.OtpResendTooSoonException = OtpResendTooSoonException;
