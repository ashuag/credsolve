"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ApiExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const logger_utils_1 = require("../logging/logger.utils");
function isDevelopmentEnvironment() {
    const environment = process.env.NODE_ENV?.trim().toLowerCase();
    return environment === 'dev' || environment === 'development';
}
let ApiExceptionFilter = ApiExceptionFilter_1 = class ApiExceptionFilter {
    logger = new common_1.Logger(ApiExceptionFilter_1.name);
    catch(exception, host) {
        const context = host.switchToHttp();
        const response = context.getResponse();
        const request = context.getRequest();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            response.status(status).json(typeof exceptionResponse === 'string'
                ? {
                    statusCode: status,
                    message: exceptionResponse
                }
                : exceptionResponse);
            return;
        }
        const isDev = isDevelopmentEnvironment();
        const error = exception instanceof Error ? exception : new Error('Internal server error');
        (0, logger_utils_1.errorWithStack)(this.logger, `${request.method} ${request.url} failed`, error);
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message: isDev ? error.message : 'Internal server error',
            errorCode: 'INTERNAL_SERVER_ERROR',
            ...(isDev
                ? {
                    details: {
                        name: error.name,
                        stack: error.stack
                    }
                }
                : {})
        });
    }
};
exports.ApiExceptionFilter = ApiExceptionFilter;
exports.ApiExceptionFilter = ApiExceptionFilter = ApiExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], ApiExceptionFilter);
