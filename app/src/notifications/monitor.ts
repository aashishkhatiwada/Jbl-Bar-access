import type {BarState} from '../api/types';
import {REARM_MARGIN, REAR_LOW_BATTERY_PERCENT} from './thresholds';

export type Side = 'left' | 'right';

export interface MonitorState {
  armed: Record<Side, boolean>;
  lastCheck: number; // last evaluation, ms
  lastSample: number; // last time a usable battery sample was seen, ms
  battery: Record<Side, number | null>;
  docked: boolean | null;
  power: string | null;
}

export const INITIAL_MONITOR: MonitorState = {
  armed: {left: true, right: true},
  lastCheck: 0,
  lastSample: 0,
  battery: {left: null, right: null},
  docked: null,
  power: null,
};

export type Reason = 'docked' | 'unknown' | 'unreachable' | 'standby' | 'ok' | 'low';

export interface Evaluation {
  next: MonitorState;
  notify: {side: Side; percent: number}[];
  reasons: Record<Side, Reason>;
}

function percent(value: unknown): number | null {
  // The firmware never treats 0 as low; it means "not reported".
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100 ? (value as number) : null;
}

// Pure: one state sample in, notifications to send and the next arm state
// out. Notifies once per speaker per discharge cycle; re-arms when the
// battery rises to threshold + REARM_MARGIN or the speakers are docked.
export function evaluate(prev: MonitorState, s: BarState | null, now: number, threshold = REAR_LOW_BATTERY_PERCENT): Evaluation {
  const next: MonitorState = {...prev, armed: {...prev.armed}, battery: {...prev.battery}, lastCheck: now};
  const notify: Evaluation['notify'] = [];
  const reasons = {left: 'unreachable', right: 'unreachable'} as Record<Side, Reason>;
  if (!s || !s.available) return {next, notify, reasons};
  next.power = s.power ?? null;
  const docked = typeof s.sound?.rear_docked === 'boolean' ? s.sound.rear_docked : null;
  next.docked = docked;
  for (const side of ['left', 'right'] as Side[]) {
    const value = percent(side === 'left' ? s.sound?.rear_battery_left : s.sound?.rear_battery_right);
    if (value !== null) {
      next.battery[side] = value;
      next.lastSample = now;
    }
    if (docked === true) {
      next.armed[side] = true;
      reasons[side] = 'docked';
      continue;
    }
    if (docked === null || value === null) {
      reasons[side] = 'unknown';
      continue;
    }
    if (value >= threshold + REARM_MARGIN) next.armed[side] = true;
    // Battery telemetry is cached while the bar sleeps; don't alert on it.
    if (s.power !== 'On') {
      reasons[side] = 'standby';
      continue;
    }
    if (value <= threshold) {
      reasons[side] = 'low';
      if (next.armed[side]) {
        next.armed[side] = false;
        notify.push({side, percent: value});
      }
    } else reasons[side] = 'ok';
  }
  return {next, notify, reasons};
}

export function sanitize(value: any): MonitorState {
  if (!value || typeof value !== 'object') return INITIAL_MONITOR;
  const side = (o: any, k: Side, d: any) => (o && typeof o[k] === typeof d ? o[k] : d);
  return {
    armed: {left: side(value.armed, 'left', true), right: side(value.armed, 'right', true)},
    lastCheck: Number(value.lastCheck) || 0,
    lastSample: Number(value.lastSample) || 0,
    battery: {left: Number.isInteger(value.battery?.left) ? value.battery.left : null, right: Number.isInteger(value.battery?.right) ? value.battery.right : null},
    docked: typeof value.docked === 'boolean' ? value.docked : null,
    power: typeof value.power === 'string' ? value.power : null,
  };
}
