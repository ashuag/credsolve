import {Logger} from '@nestjs/common';

export function describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
}

export function warnWithError(logger: Logger, message: string, error: unknown): void {
    logger.warn(`${message}: ${describeError(error)}`);
}

export function errorWithStack(logger: Logger, message: string, error: unknown): void {
    if (error instanceof Error) {
        logger.error(`${message}: ${error.message}`, error.stack);
        return;
    }

    logger.error(message);
}

export function logMessage(logger: Logger, message: any): void {
  logger.log(message);
}


