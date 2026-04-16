"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpConfigurationException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class OtpConfigurationException extends app_exception_1.AppException {
    constructor(resource) {
        super(common_1.HttpStatus.INTERNAL_SERVER_ERROR, 'OTP configuration is incomplete.', 'OTP_CONFIGURATION_MISSING', { resource });
    }
}
exports.OtpConfigurationException = OtpConfigurationException;
