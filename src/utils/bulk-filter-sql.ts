import { IBulkFilter } from '../entities/bulk-job';
import { SqlValue } from '../types/sql-value';

export interface IFilterSql {
  readonly clause: string;
  readonly values: SqlValue[];
}

export function bulkFilterSql(
  filter: IBulkFilter,
  jobCreatedAt: Date,
  startIndex: number,
  alias: string,
): IFilterSql {
  const owner = startIndex;
  const status = startIndex + 1;
  const valueMin = startIndex + 2;
  const valueMax = startIndex + 3;
  const createdAfter = startIndex + 4;
  const createdBefore = startIndex + 5;
  const jobCreated = startIndex + 6;
  const col = (name: string): string => `${alias}.${name}`;
  const clause = [
    `AND ($${owner}::text IS NULL OR ${col('owner_id')} = $${owner})`,
    `AND ($${status}::text IS NULL OR ${col('status')} = $${status})`,
    `AND ($${valueMin}::bigint IS NULL OR ${col('value')} >= $${valueMin})`,
    `AND ($${valueMax}::bigint IS NULL OR ${col('value')} <= $${valueMax})`,
    `AND ($${createdAfter}::timestamptz IS NULL OR ${col('created_at')} >= $${createdAfter})`,
    `AND ($${createdBefore}::timestamptz IS NULL OR ${col('created_at')} <= $${createdBefore})`,
    `AND ${col('created_at')} <= $${jobCreated}`,
  ].join('\n');
  return {
    clause,
    values: [
      filter.ownerId ?? null,
      filter.status ?? null,
      filter.valueMin ?? null,
      filter.valueMax ?? null,
      filter.createdAfter ?? null,
      filter.createdBefore ?? null,
      jobCreatedAt,
    ],
  };
}
