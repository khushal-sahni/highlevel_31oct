import { QueryResult, QueryResultRow } from 'pg';

export interface IQueryClient {
  query<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
}
