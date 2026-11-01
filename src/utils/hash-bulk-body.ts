import { createHash } from 'crypto';
import { IBulkFilter } from '../entities/bulk-job';

export interface IHashableBulkBody {
  readonly targetStageId: string;
  readonly filter: IBulkFilter;
}

export function hashBulkBody(input: IHashableBulkBody): string {
  // Fixed key order so the same body always hashes the same.
  const payload = JSON.stringify({
    targetStageId: input.targetStageId,
    filter: {
      createdAfter: toIso(input.filter.createdAfter),
      createdBefore: toIso(input.filter.createdBefore),
      ownerId: input.filter.ownerId ?? null,
      stageId: input.filter.stageId ?? null,
      status: input.filter.status ?? null,
      valueMax: input.filter.valueMax ?? null,
      valueMin: input.filter.valueMin ?? null,
    },
  });
  return createHash('sha256').update(payload).digest('hex');
}

function toIso(value: Date | undefined): string | null {
  return value === undefined ? null : value.toISOString();
}
