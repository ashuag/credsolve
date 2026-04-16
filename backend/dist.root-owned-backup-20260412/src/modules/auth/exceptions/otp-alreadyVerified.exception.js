"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpAlreadyUsedException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpAlreadyUsedException extends app_exception_1.AppException {
    constructor() {
        super(common_1.HttpStatus.BAD_REQUEST, 'OTP already verified. Please request a fresh OTP.', 'OTP_ALREADY_VERIFIED');
    }
}
exports.OtpAlreadyUsedException = OtpAlreadyUsedException;
