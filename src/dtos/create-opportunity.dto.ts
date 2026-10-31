import { OpportunityStatus } from '../types/opportunity-status';
import { isOpportunityStatus } from '../types/opportunity-status';
import { ValidationError } from '../errors/app.error';
import {
  requireRecord,
  requireSafeInteger,
  requireString,
  requireUuid,
} from '../utils/parse';

export interface ICreateOpportunityInput {
  readonly name: string;
  readonly value: number;
  readonly status: OpportunityStatus;
  readonly ownerId: string;
  readonly stageId: string;
}

export class CreateOpportunityDto {
  static fromBody(body: unknown): ICreateOpportunityInput {
    const record = requireRecord(body);
    const status = requireString(record, 'status');
    if (!isOpportunityStatus(status)) {
      throw new ValidationError('status must be open, won, lost, or abandoned');
    }
    const value = requireSafeInteger(record, 'value');
    if (value < 0) {
      throw new ValidationError('value must be a non-negative integer');
    }
    return {
      name: requireString(record, 'name'),
      value,
      status,
      ownerId: requireString(record, 'ownerId'),
      stageId: requireUuid(requireString(record, 'stageId'), 'stageId'),
    };
  }
}
