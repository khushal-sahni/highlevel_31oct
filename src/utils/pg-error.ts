interface IPgError {
  readonly code: string;
}

export function isPgError(error: unknown): error is IPgError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return isPgError(error) && error.code === '23505';
}

export function isLockTimeout(error: unknown): boolean {
  return isPgError(error) && error.code === '55P03';
}
