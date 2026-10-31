import { IJsonObject } from '../types/json';
import {
  requireSafeInteger,
  requireString,
  requireUuid,
} from '../utils/parse';
import { ValidationError } from '../errors/app.error';

export interface IMoveOpportunityInput {
  readonly stageId: string;
  readonly expectedVersion: number;
}

export class MoveOpportunityDto {
  static fromBody(body: IJsonObject): IMoveOpportunityInput {
    const expectedVersion = requireSafeInteger(body, 'expectedVersion');
    if (expectedVersion < 1) {
      throw new ValidationError('expectedVersion must be at least 1');
    }
    return {
      stageId: requireUuid(requireString(body, 'stageId'), 'stageId'),
      expectedVersion,
    };
  }
}
