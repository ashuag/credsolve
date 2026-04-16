import { InternalServerErrorException } from '@nestjs/common';

export class ApplicationConfigurationException extends InternalServerErrorException {
  constructor(public readonly resource: string) {
    super(`Application configuration error: ${resource}`);
  }
}
