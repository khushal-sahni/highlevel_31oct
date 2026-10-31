import { QueryResult, QueryResultRow } from 'pg';
import { SqlValue } from './sql-value';

export interface IQueryClient {
  query<T extends QueryResultRow>(
    text: string,
    values?: SqlValue[],
  ): Promise<QueryResult<T>>;
}
