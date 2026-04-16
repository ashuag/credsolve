"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadConfigurationException = void 0;
class LeadConfigurationException extends Error {
    resource;
    constructor(resource) {
        super(resource);
        this.resource = resource;
        this.name = LeadConfigurationException.name;
    }
}
exports.LeadConfigurationException = LeadConfigurationException;
