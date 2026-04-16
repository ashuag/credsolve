"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingConfigurationException = void 0;
class OnboardingConfigurationException extends Error {
    resource;
    constructor(resource) {
        super(resource);
        this.resource = resource;
        this.name = OnboardingConfigurationException.name;
    }
}
exports.OnboardingConfigurationException = OnboardingConfigurationException;
