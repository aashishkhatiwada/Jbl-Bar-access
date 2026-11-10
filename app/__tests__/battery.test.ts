import {evaluate, INITIAL_MONITOR, sanitize} from '../src/notifications/monitor';
import {REAR_LOW_BATTERY_PERCENT} from '../src/notifications/thresholds';
import {baseState} from './helpers/fakeBar';

const T = REAR_LOW_BATTERY_PERCENT;
const at = (left: number, right: number, extra: any = {}) =>
  baseState({power: 'On', ...extra, sound: {rear_docked: false, rear_battery_left: left, rear_battery_right: right, ...(extra.sound || {})}});

describe('battery-low notification', () => {
  test('threshold is the firmware value', () => {
    expect(T).toBe(14);
  });

  test('fires at the threshold, once per speaker per discharge cycle', () => {
    let m = INITIAL_MONITOR;
    let r = evaluate(m, at(T + 1, 50), 1);
    expect(r.notify).toEqual([]);
    r = evaluate(r.next, at(T, 50), 2);
    expect(r.notify).toEqual([{side: 'left', percent: T}]);
    r = evaluate(r.next, at(T - 1, 50), 3);
    expect(r.notify).toEqual([]);
    r = evaluate(r.next, at(T - 2, T), 4);
    expect(r.notify).toEqual([{side: 'right', percent: T}]);
  });

  test('suppressed while docked, and docking re-arms', () => {
    let r = evaluate(INITIAL_MONITOR, at(5, 5, {sound: {rear_docked: true}}), 1);
    expect(r.notify).toEqual([]);
    expect(r.reasons.left).toBe('docked');
    r = evaluate(r.next, at(5, 50), 2);
    expect(r.notify.map(n => n.side)).toEqual(['left']);
    r = evaluate(r.next, at(5, 50, {sound: {rear_docked: true}}), 3);
    expect(r.next.armed.left).toBe(true);
    r = evaluate(r.next, at(6, 50), 4);
    expect(r.notify.map(n => n.side)).toEqual(['left']);
  });

  test('re-arms only after rising to threshold + 5', () => {
    let r = evaluate(INITIAL_MONITOR, at(T, 50), 1);
    expect(r.notify).toHaveLength(1);
    r = evaluate(r.next, at(T + 4, 50), 2);
    r = evaluate(r.next, at(T, 50), 3);
    expect(r.notify).toHaveLength(0);
    r = evaluate(r.next, at(T + 5, 50), 4);
    r = evaluate(r.next, at(T, 50), 5);
    expect(r.notify).toHaveLength(1);
  });

  test('unknown battery or unreachable bar is suppressed', () => {
    expect(evaluate(INITIAL_MONITOR, null, 1).notify).toEqual([]);
    expect(evaluate(INITIAL_MONITOR, {available: false}, 1).notify).toEqual([]);
    // 0 is "not reported" in the firmware, never low.
    expect(evaluate(INITIAL_MONITOR, at(0, 0), 1).notify).toEqual([]);
    const noDock = baseState({power: 'On', sound: {rear_battery_left: 3, rear_battery_right: 3}});
    expect(evaluate(INITIAL_MONITOR, noDock, 1).notify).toEqual([]);
  });

  test('standby with stale sample is suppressed, but keeps the reading', () => {
    const r = evaluate(INITIAL_MONITOR, at(5, 5, {power: 'Standby'}), 9);
    expect(r.notify).toEqual([]);
    expect(r.reasons.left).toBe('standby');
    expect(r.next.battery.left).toBe(5);
    expect(r.next.lastSample).toBe(9);
    expect(r.next.armed.left).toBe(true);
  });

  test('stored state is sanitized', () => {
    expect(sanitize(null)).toEqual(INITIAL_MONITOR);
    expect(sanitize({armed: {left: false}, battery: {left: 12}}).armed).toEqual({left: false, right: true});
  });
});
