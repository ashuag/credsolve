import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: 'moneyCash-backend',
      ok: true,
    };
  }
}
