import { OpportunityStatus } from '../types/opportunity-status';
import { isOpportunityStatus } from '../types/opportunity-status';
import { ValidationError } from '../errors/app.error';
import { IJsonObject } from '../types/json';
import {
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
  static fromBody(body: IJsonObject): ICreateOpportunityInput {
    const status = requireString(body, 'status');
    if (!isOpportunityStatus(status)) {
      throw new ValidationError('status must be open, won, lost, or abandoned');
    }
    const value = requireSafeInteger(body, 'value');
    if (value < 0) {
      throw new ValidationError('value must be a non-negative integer');
    }
    return {
      name: requireString(body, 'name'),
      value,
      status,
      ownerId: requireString(body, 'ownerId'),
      stageId: requireUuid(requireString(body, 'stageId'), 'stageId'),
    };
  }
}
