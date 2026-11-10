import {Controller} from '../src/engine/controller';
import {validate} from '../src/components/SetValueDialog';
import {automationLock, connection, disabled, summary, volumeView} from '../src/engine/view';
import {eqView} from '../src/engine/eq';
import {offsetView} from '../src/engine/bassOffset';
import {contrast} from '../src/theme/contrast';
import {colors} from '../src/theme/tokens';
import {baseState, FakeBar, flush} from './helpers/fakeBar';


const live: Controller[] = [];
afterEach(() => live.splice(0).forEach(c => c.dispose()));

async function snapOf(state = baseState()) {
  const bar = new FakeBar(state);
  const c = new Controller({host: 'x', api: bar.api(), stream: bar.streamFactory});
  live.push(c);
  await c.start();
  await flush();
  return {c, bar, snap: () => c.getSnapshot()};
}

describe('typed entry validation', () => {
  const volume = {min: 0, max: 31, step: 1};
  const eq = {min: -6, max: 0, step: 0.5, unit: 'dB'};
  const offset = {min: -3, max: 3, step: 0.5, unit: 'dB'};
  test('accepts in-range values and snaps to step', () => {
    expect(validate('25', volume)).toEqual({ok: true, value: 25});
    expect(validate('12.4', volume)).toEqual({ok: true, value: 12});
    expect(validate('−2.3', eq)).toEqual({ok: true, value: -2.5});
    expect(validate('1,5', offset)).toEqual({ok: true, value: 1.5});
  });
  test('cuts-only range reads a positive number as a cut', () => {
    expect(validate('2.5', eq)).toEqual({ok: true, value: -2.5});
  });
  test('rejects non-numbers and out-of-range', () => {
    expect(validate('', volume).ok).toBe(false);
    expect(validate('loud', volume)).toEqual({ok: false, error: 'Enter a number.'});
    const r = validate('40', volume);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Out of range. Enter 0 to 31, step 1.');
    expect(validate('4', offset).ok).toBe(false);
  });
});

describe('view rules (web parity)', () => {
  test('standby: only power is enabled', async () => {
    const {snap} = await snapOf(baseState({power: 'Standby'}));
    expect(disabled(snap(), 'power')).toBe(false);
    expect(disabled(snap(), 'volume_up')).toBe(true);
    expect(summary(snap())).toBe('In standby. Ready when you are.');
    expect(volumeView(snap()).caption).toBe('IN STANDBY');
  });

  test('pending action disables everything except volume during a volume run', async () => {
    const {c, snap} = await snapOf();
    c.enqueue('volume_up');
    expect(disabled(snap(), 'volume_up')).toBe(false);
    expect(disabled(snap(), 'mute')).toBe(true);
    expect(disabled(snap(), 'input_hdmi')).toBe(true);
  });

  test('automation lock blocks controls with an explanation', async () => {
    const {snap} = await snapOf(baseState({automation: {enabled: true, status: 'AWAKE_STABILIZING_2'}}));
    expect(automationLock(snap())).toMatch(/Checking the sound mode after wake/);
    expect(disabled(snap(), 'volume_up')).toBe(true);
  });

  test('calibration locks every control', async () => {
    const {snap} = await snapOf(baseState({setup: {calibration: 'Measuring 1 of 2'}}));
    expect(disabled(snap(), 'volume_up')).toBe(true);
  });

  test('connection pill and summary', async () => {
    const {snap} = await snapOf();
    expect(connection(snap())).toEqual({state: 'online', label: 'Connected'});
    expect(summary(snap())).toBe('TV / ARC · Standard mode');
  });

  test('volume view shows the planned target and progress', async () => {
    const {c, bar, snap} = await snapOf();
    c.setVolume(14);
    await bar.complete();
    const v = volumeView(snap());
    expect(v.value).toBe(14);
    expect(v.plan).toMatchObject({target: 14, total: 4, step: 2});
  });

  test('EQ: draft enables Apply; standby with a keeping remote saves for later', async () => {
    const eq = {available: true, enabled: false, gains_db: [0, 0, 0, 0, 0], status: 'original', kept: false};
    const {snap} = await snapOf(baseState({eq}));
    let v = eqView(snap(), [0, 0, 0, 0, 0]);
    expect(v.applyDisabled).toBe(true);
    v = eqView(snap(), [-2, 0, 0, 0, 0]);
    expect(v.applyDisabled).toBe(false);
    expect(v.state).toBe('Unapplied changes. Select Apply EQ to listen.');
    const later = await snapOf(baseState({power: 'Standby', eq: {...eq, available: false}}));
    const w = eqView(later.snap(), [-2, 0, 0, 0, 0]);
    expect(w.saveLater).toBe(true);
    expect(w.applyLabel).toBe('Save EQ');
  });

  test('bass offset view', async () => {
    const {snap} = await snapOf(baseState({bass_offset: {offset_db: 0, status: 'original'}}));
    expect(offsetView(snap(), 0).state).toBe('0.0 dB set. Original tuning.');
    expect(offsetView(snap(), 1.5)).toMatchObject({changed: true, saveDisabled: false});
  });
});

describe('contrast audit', () => {
  const text = ['text', 'muted', 'subtle', 'orange', 'green', 'danger', 'selectedText', 'feedbackReadable', 'captionReadable', 'bassCaption', 'devTag', 'batteryText', 'subCaption', 'applyText', 'vital', 'helpStrong', 'violet'] as const;
  for (const name of text) {
    test(name + ' ≥ 4.5:1 on panel and background', () => {
      expect(contrast(colors[name], colors.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors[name], colors.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
