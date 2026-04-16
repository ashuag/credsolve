"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationConfigurationException = void 0;
const common_1 = require("@nestjs/common");
class ApplicationConfigurationException extends common_1.InternalServerErrorException {
    resource;
    constructor(resource) {
        super(`Application configuration error: ${resource}`);
        this.resource = resource;
    }
}
exports.ApplicationConfigurationException = ApplicationConfigurationException;
