import { AdminUser } from '../../domain/identity/admin-user';
import type { AdminUserRepository } from '../../domain/identity/admin-user-repository';
import { PostgresDao, type SqlConnection } from '../database/postgres-dao';

export class PgAdminUserRepository extends PostgresDao implements AdminUserRepository {
  constructor(connection: SqlConnection) { super(connection); }
  async findByEmail(email: string) {
    const row = await this.first<{ id: number; email: string; password_hash: string }>('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    return row && new AdminUser(row.id, row.email, row.password_hash);
  }
}
