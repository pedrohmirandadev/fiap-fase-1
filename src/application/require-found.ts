import { ApplicationError, ErrorKind } from './errors';
export function requireFound<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new ApplicationError(ErrorKind.NotFound, `${label} não encontrado`);
  return value;
}
