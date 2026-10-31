import { ValidationError } from '../errors/app.error';
import { IJsonObject, IJsonValue } from '../types/json';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireRecord(body: unknown): IJsonObject {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be an object');
  }
  return body as IJsonObject;
}

export function requireString(body: IJsonObject, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${key} must be a non-empty string`);
  }
  return value.trim();
}

export function requireSafeInteger(body: IJsonObject, key: string): number {
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
  query: IJsonObject,
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

export function optionalSafeInteger(
  body: IJsonObject,
  key: string,
): number | undefined {
  if (body[key] === undefined) {
    return undefined;
  }
  return requireSafeInteger(body, key);
}

export function optionalUuidField(
  body: IJsonObject,
  key: string,
): string | undefined {
  const value = optionalString(body, key);
  return value === undefined ? undefined : requireUuid(value, key);
}

export function optionalIsoDate(
  body: IJsonObject,
  key: string,
): Date | undefined {
  const value = optionalString(body, key);
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${key} must be an ISO date`);
  }
  return date;
}

export function queryString(
  query: IJsonObject,
  key: string,
): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  return requireQueryString(value, key);
}

function requireQueryString(value: IJsonValue, key: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${key} must be a string`);
  }
  return value;
}
