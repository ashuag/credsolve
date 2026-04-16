"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailDeliveryException = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/exceptions/app.exception");
class MailDeliveryException extends app_exception_1.AppException {
    constructor() {
        super(common_1.HttpStatus.SERVICE_UNAVAILABLE, 'Unable to send email right now. Please try again.', 'MAIL_DELIVERY_FAILED');
    }
}
exports.MailDeliveryException = MailDeliveryException;
