import { Module } from '@nestjs/common';
import { CustomerRepository } from './repositories/customer.repository';
import { CustomerService } from './services/customer.service';

@Module({
  providers: [
    CustomerRepository,
    CustomerService
  ],
  exports: [CustomerService]
})
export class CustomerModule {}
