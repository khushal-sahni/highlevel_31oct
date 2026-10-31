import { ValidationError } from '../errors/app.error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object');
  }
  return body as Record<string, unknown>;
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${key} must be a non-empty string`);
  }
  return value.trim();
}

export function requireSafeInteger(
  body: Record<string, unknown>,
  key: string,
): number {
  const value = body[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ValidationError(`${key} must be an integer`);
  }
  return value;
}

export function requireUuid(value: string, key: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new ValidationError(`${key} must be a UUID`);
  }
  return value;
}

export function optionalString(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${key} must be a non-empty string`);
  }
  return value.trim();
}
