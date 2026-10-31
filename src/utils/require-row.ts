export function requireRow<T>(row: T | undefined, what: string): T {
  if (row === undefined) {
    throw new Error(`${what} returned no row`);
  }
  return row;
}
