import { IBulkFilter } from '../entities/bulk-job';
import { ValidationError } from '../errors/app.error';
import { isOpportunityStatus, OpportunityStatus } from '../types/opportunity-status';
import {
  optionalIsoDate,
  optionalSafeInteger,
  optionalString,
  optionalUuidField,
  requireRecord,
  requireString,
  requireUuid,
} from '../utils/parse';

export interface ICreateBulkMoveInput {
  readonly targetStageId: string;
  readonly filter: IBulkFilter;
}

export class CreateBulkMoveDto {
  static fromBody(body: unknown): ICreateBulkMoveInput {
    const record = requireRecord(body);
    const filter = CreateBulkMoveDto.parseFilter(record);
    CreateBulkMoveDto.assertHasFilter(filter);
    return {
      targetStageId: requireUuid(
        requireString(record, 'targetStageId'),
        'targetStageId',
      ),
      filter,
    };
  }

  private static parseFilter(record: Record<string, unknown>): IBulkFilter {
    return {
      stageId: optionalUuidField(record, 'stageId'),
      ownerId: optionalString(record, 'ownerId'),
      status: CreateBulkMoveDto.parseStatus(record),
      valueMin: CreateBulkMoveDto.optionalCents(record, 'valueMin'),
      valueMax: CreateBulkMoveDto.optionalCents(record, 'valueMax'),
      createdAfter: optionalIsoDate(record, 'createdAfter'),
      createdBefore: optionalIsoDate(record, 'createdBefore'),
    };
  }

  private static parseStatus(
    record: Record<string, unknown>,
  ): OpportunityStatus | undefined {
    const status = optionalString(record, 'status');
    if (status === undefined) {
      return undefined;
    }
    if (!isOpportunityStatus(status)) {
      throw new ValidationError('status must be open, won, lost, or abandoned');
    }
    return status;
  }

  private static optionalCents(
    record: Record<string, unknown>,
    key: string,
  ): number | undefined {
    const value = optionalSafeInteger(record, key);
    if (value !== undefined && value < 0) {
      throw new ValidationError(`${key} must be a non-negative integer`);
    }
    return value;
  }

  private static assertHasFilter(filter: IBulkFilter): void {
    const present = [
      filter.stageId,
      filter.ownerId,
      filter.status,
      filter.valueMin,
      filter.valueMax,
      filter.createdAfter,
      filter.createdBefore,
    ].some((value) => value !== undefined);
    if (!present) {
      throw new ValidationError('at least one filter field is required');
    }
  }
}
