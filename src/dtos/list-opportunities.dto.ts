import { optionalString, requireUuid } from '../utils/parse';
import { ValidationError } from '../errors/app.error';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface IListOpportunitiesQuery {
  readonly stageId: string;
  readonly limit: number;
  readonly cursor?: string;
}

export class ListOpportunitiesDto {
  static fromQuery(query: Record<string, unknown>): IListOpportunitiesQuery {
    const stageId = optionalString(query, 'stageId');
    if (stageId === undefined) {
      throw new ValidationError('stageId is required');
    }
    return {
      stageId: requireUuid(stageId, 'stageId'),
      limit: ListOpportunitiesDto.parseLimit(query['limit']),
      cursor: ListOpportunitiesDto.parseCursor(query['cursor']),
    };
  }

  private static parseLimit(raw: unknown): number {
    if (raw === undefined) {
      return DEFAULT_LIMIT;
    }
    const value = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new ValidationError('limit must be an integer');
    }
    if (value < 1 || value > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`);
    }
    return value;
  }

  private static parseCursor(raw: unknown): string | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    if (typeof raw !== 'string') {
      throw new ValidationError('cursor must be a UUID');
    }
    return requireUuid(raw, 'cursor');
  }
}
