import type { Customer } from './customer';
export interface CustomerRepository {
  findById(id: number): Promise<Customer | undefined>;
  findByDocument(document: string): Promise<Customer | undefined>;
  findAll(limit: number, offset: number): Promise<Customer[]>;
  save(customer: Customer): Promise<Customer>;
  /** Remove o cliente, seus veículos e OS com os respectivos filhos; preserva estoque e eventos. */
  delete(id: number): Promise<boolean>;
}
