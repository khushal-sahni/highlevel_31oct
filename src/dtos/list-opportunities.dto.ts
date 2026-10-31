import { ValidationError } from '../errors/app.error';
import { IJsonObject } from '../types/json';
import { optionalString, queryString, requireUuid } from '../utils/parse';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface IListOpportunitiesQuery {
  readonly stageId: string;
  readonly limit: number;
  readonly cursor?: string;
}

export class ListOpportunitiesDto {
  static fromQuery(query: IJsonObject): IListOpportunitiesQuery {
    const stageId = optionalString(query, 'stageId');
    if (stageId === undefined) {
      throw new ValidationError('stageId is required');
    }
    return {
      stageId: requireUuid(stageId, 'stageId'),
      limit: ListOpportunitiesDto.parseLimit(queryString(query, 'limit')),
      cursor: ListOpportunitiesDto.parseCursor(queryString(query, 'cursor')),
    };
  }

  private static parseLimit(raw: string | undefined): number {
    if (raw === undefined || raw === '') {
      return DEFAULT_LIMIT;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value)) {
      throw new ValidationError('limit must be an integer');
    }
    if (value < 1 || value > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`);
    }
    return value;
  }

  private static parseCursor(raw: string | undefined): string | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    return requireUuid(raw, 'cursor');
  }
}
