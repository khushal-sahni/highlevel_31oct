export type SqlPrimitive = string | number | Date | null;

export type SqlValue = SqlPrimitive | readonly SqlPrimitive[];
