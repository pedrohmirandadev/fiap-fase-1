import { compare } from 'bcryptjs';
import { ApplicationError, ErrorKind } from '../errors';
import type { AdminUserRepository } from '../../domain/identity/admin-user-repository';

export class AuthenticateAdmin {
  constructor(private readonly users: AdminUserRepository) {}

  async execute(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new ApplicationError(ErrorKind.Unauthorized, 'Credenciais inválidas');
    }
    return { sub: String(user.id), email: user.email };
  }
}
