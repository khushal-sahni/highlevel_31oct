import {
  requireRecord,
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
  static fromBody(body: unknown): IMoveOpportunityInput {
    const record = requireRecord(body);
    const expectedVersion = requireSafeInteger(record, 'expectedVersion');
    if (expectedVersion < 1) {
      throw new ValidationError('expectedVersion must be at least 1');
    }
    return {
      stageId: requireUuid(requireString(record, 'stageId'), 'stageId'),
      expectedVersion,
    };
  }
}
