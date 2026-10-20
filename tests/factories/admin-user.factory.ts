import { hashSync } from 'bcryptjs';
import { AdminUser } from '../../src/domain/identity/admin-user';
import type { FactoryContext } from './factory-context';

export const FIXTURE_ADMIN_PASSWORD = 'SenhaDeTeste123!';
type AdminUserProps = { id: number; email: string; password: string; passwordHash?: string };

export function createAdminUserFactory(context: FactoryContext) {
  return (overrides: Partial<AdminUserProps> = {}): AdminUser => {
    const sequence = context.nextId('adminUser');
    const props = { id: sequence, email: `admin${sequence}@example.test`, password: FIXTURE_ADMIN_PASSWORD, ...overrides };
    return new AdminUser(props.id, props.email, props.passwordHash ?? hashSync(props.password, 4));
  };
}
