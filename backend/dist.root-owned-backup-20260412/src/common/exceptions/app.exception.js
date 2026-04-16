"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
const common_1 = require("@nestjs/common");
class AppException extends common_1.HttpException {
    constructor(status, message, errorCode, details) {
        const response = {
            statusCode: status,
            message,
            errorCode,
            ...(details ? { details } : {})
        };
        super(response, status);
    }
}
exports.AppException = AppException;
