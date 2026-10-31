export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = samples.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

export interface ILatencyReport {
  readonly count: number;
  readonly p95: number;
  readonly p99: number;
}

export function latencyReport(samples: readonly number[]): ILatencyReport {
  return {
    count: samples.length,
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
  };
}
