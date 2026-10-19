export enum DomainErrorKind {
  Validation = 'validation',
  Conflict = 'conflict'
}

export class DomainError extends Error {
  constructor(message: string, readonly kind: DomainErrorKind = DomainErrorKind.Validation) { super(message); }
}
