"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeError = describeError;
exports.warnWithError = warnWithError;
exports.errorWithStack = errorWithStack;
exports.logMessage = logMessage;
function describeError(error) {
    return error instanceof Error ? error.message : 'Unknown error';
}
function warnWithError(logger, message, error) {
    logger.warn(`${message}: ${describeError(error)}`);
}
function errorWithStack(logger, message, error) {
    if (error instanceof Error) {
        logger.error(`${message}: ${error.message}`, error.stack);
        return;
    }
    logger.error(message);
}
function logMessage(logger, message) {
    logger.log(message);
}
