import { Injectable } from '@nestjs/common';
import { type DatabaseSession } from '../../../../prisma/database-session';
import { type CustomerProfile } from '../customer.types';
import { CustomerRepository } from '../repositories/customer.repository';

@Injectable()
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async ensureByMobileNumber(
    mobileNumber: string,
    session?: DatabaseSession
  ): Promise<CustomerProfile | undefined> {
    const customer = await this.customerRepository.ensureByMobileNumber(mobileNumber, session);

    if (!customer) {
      return undefined;
    }

    return {
      id: customer.id.toString(),
      uuid: customer.uuid,
      mobileNumber: customer.mobileNumber,
      createdAt: customer.createdAt.toISOString()
    };
  }
}
