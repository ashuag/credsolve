"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpExpiredException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpExpiredException extends app_exception_1.AppException {
    constructor() {
        super(common_1.HttpStatus.BAD_REQUEST, 'OTP expired. Please request a fresh OTP.', 'OTP_EXPIRED');
    }
}
exports.OtpExpiredException = OtpExpiredException;
