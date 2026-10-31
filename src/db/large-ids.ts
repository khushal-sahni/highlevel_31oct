export const LARGE_WORKSPACE_ID = '33333333-3333-4333-8333-333333333333';

export const SMALL_WORKSPACE_IDS: readonly string[] = [
  '44444444-4444-4444-8444-000000000001',
  '44444444-4444-4444-8444-000000000002',
  '44444444-4444-4444-8444-000000000003',
  '44444444-4444-4444-8444-000000000004',
  '44444444-4444-4444-8444-000000000005',
];

export const LARGE_STAGE_NAMES: readonly string[] = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
  'Discovery',
  'Demo',
  'Contract Review',
  'Onboarding',
  'Churned',
];

export const LARGE_STAGE_COUNTS: readonly number[] = [
  120_000, 80_000, 60_000, 50_000, 45_000, 40_000, 30_000, 25_000, 20_000,
  15_000, 10_000, 5_000,
];

export const SMALL_STAGE_COUNTS: readonly number[] = [
  500, 400, 350, 300, 280, 250, 220, 200, 180, 150, 100, 70,
];

export const LARGE_SEED_START = '2025-04-30T00:00:00.000Z';

export function largeStageId(position: number): string {
  const suffix = position.toString().padStart(12, '0');
  return `55555555-5555-4555-8555-${suffix}`;
}

export function smallStageId(workspaceIndex: number, position: number): string {
  const suffix = `${workspaceIndex}${position.toString().padStart(11, '0')}`;
  return `66666666-6666-4666-8666-${suffix}`;
}

export interface IBenchmarkTarget {
  readonly largeWorkspaceId: string;
  readonly smallWorkspaceId: string;
  readonly smallSourceStageId: string;
  readonly sourceStageId: string;
  readonly targetStageId: string;
  readonly interactiveFromStageId: string;
  readonly interactiveToStageId: string;
  readonly primary: {
    readonly createdBefore: string;
  };
  readonly resume: {
    readonly createdAfter: string;
    readonly createdBefore: string;
  };
}
