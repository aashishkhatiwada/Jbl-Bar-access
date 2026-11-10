// The bar only steps levels forward (*_next), so choosing a segment becomes
// the number of confirmed steps that reach it, wrapping around.
export function cycleSteps(value: unknown, target: number, count: number): number {
  if (!Number.isInteger(value) || !Number.isInteger(target) || target < 0 || target >= count) return 0;
  return (target - (value as number) + count) % count;
}

export interface LevelSpec {
  action: string;
  count: number;
  labels: string[];
}

export const LEVELS: Record<'bass' | 'center' | 'atmos' | 'rear', LevelSpec> = {
  bass: {action: 'bass_next', count: 5, labels: ['1', '2', '3', '4', '5']},
  center: {action: 'center_next', count: 6, labels: ['1', '2', '3', '4', '5', '6']},
  atmos: {action: 'atmos_next', count: 3, labels: ['Low', 'Mid', 'High']},
  rear: {action: 'rear_next', count: 4, labels: ['Low', 'Mid', 'High', 'Muted']},
};

export type LevelName = keyof typeof LEVELS;

// Steps from the current volume to a target; positive is up.
export function volumeSteps(current: number, target: number, max = 31): number {
  const clamped = Math.max(0, Math.min(max, Math.round(target)));
  return clamped - current;
}
