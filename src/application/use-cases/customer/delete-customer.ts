import type { CustomerRepository } from '../../../domain/customer/customer-repository';
import { ApplicationError, ErrorKind } from '../../errors';
export class DeleteCustomer {
  constructor(private readonly repository: CustomerRepository) {}
  async execute(id: number) {
    if (!(await this.repository.delete(id))) throw new ApplicationError(ErrorKind.NotFound, 'Cliente não encontrado');
    return { deleted: true };
  }
}
