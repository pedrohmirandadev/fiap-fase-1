export enum ErrorKind {
  NotFound = 'not_found',
  Validation = 'validation',
  Conflict = 'conflict',
  Unauthorized = 'unauthorized'
}

export class ApplicationError extends Error {
  constructor(readonly kind: ErrorKind, message: string) {
    super(message);
    this.name = 'ApplicationError';
  }
}
