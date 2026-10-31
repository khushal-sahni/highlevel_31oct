export enum OpportunityStatus {
  OPEN = 'open',
  WON = 'won',
  LOST = 'lost',
  ABANDONED = 'abandoned',
}

const STATUS_VALUES = new Set<string>(Object.values(OpportunityStatus));

export function parseOpportunityStatus(value: string): OpportunityStatus {
  if (!STATUS_VALUES.has(value)) {
    throw new Error('invalid status');
  }
  return value as OpportunityStatus;
}

export function isOpportunityStatus(value: string): value is OpportunityStatus {
  return STATUS_VALUES.has(value);
}
