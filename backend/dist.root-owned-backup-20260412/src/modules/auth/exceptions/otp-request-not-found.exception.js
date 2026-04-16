"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpRequestNotFoundException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpRequestNotFoundException extends app_exception_1.AppException {
    constructor() {
        super(common_1.HttpStatus.NOT_FOUND, 'OTP request not found.', 'OTP_REQUEST_NOT_FOUND');
    }
}
exports.OtpRequestNotFoundException = OtpRequestNotFoundException;
