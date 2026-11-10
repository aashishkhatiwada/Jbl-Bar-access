import {BarError} from '../src/api/client';
import {BUSY_DELAY, Controller, MAX_QUEUED_TAPS} from '../src/engine/controller';
import {command, project, supports, manual} from '../src/engine/capabilities';
import {cycleSteps} from '../src/engine/segments';
import {snap, parseTyped, rate, uptime, eqGain} from '../src/engine/format';
import {baseState, FakeBar, FEATURES, flush, networkError} from './helpers/fakeBar';

let clock = 0;
async function setup(state = baseState()) {
  const bar = new FakeBar(state);
  const c = new Controller({host: '192.168.100.25', api: bar.api(), stream: bar.streamFactory, now: () => clock});
  await c.start();
  await flush();
  bar.stream.handlers.onOpen();
  return {bar, c};
}

beforeEach(() => {
  jest.useFakeTimers();
  clock = 1000;
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('single-flight queue', () => {
  test('one action in flight, the rest wait in order', async () => {
    const {bar, c} = await setup();
    c.enqueue('volume_up');
    c.enqueue('volume_up');
    c.enqueue('volume_up');
    expect(bar.sent).toHaveLength(1);
    expect(c.getSnapshot().queue).toEqual(['volume_up', 'volume_up']);
    await bar.complete();
    expect(bar.sent).toHaveLength(2);
    await bar.complete();
    await bar.complete();
    expect(bar.sent).toHaveLength(3);
    expect(c.getSnapshot().state?.volume).toBe(13);
    expect(c.getSnapshot().feedback.text).toBe('Volume 13');
  });

  test('opposite pending volume taps cancel', async () => {
    const {bar, c} = await setup();
    c.enqueue('volume_up'); // in flight
    c.enqueue('volume_up'); // queued
    c.enqueue('volume_down'); // cancels the queued up
    expect(c.getSnapshot().queue).toEqual([]);
    expect(c.getSnapshot().pendingVolume).toBe(1);
    await bar.complete();
    expect(bar.sent.map(b => b.action)).toEqual(['volume_up']);
  });

  test('taps are capped at 8 queued', async () => {
    const {bar, c} = await setup();
    c.enqueue('volume_up');
    for (let i = 0; i < MAX_QUEUED_TAPS + 3; i++) c.enqueue('volume_up');
    expect(c.getSnapshot().queue).toHaveLength(MAX_QUEUED_TAPS);
    expect(c.getSnapshot().feedback.text).toBe('Let the pending volume changes finish first.');
    expect(bar.sent).toHaveLength(1);
  });

  test('a failed action clears the queue and is never replayed', async () => {
    const {bar, c} = await setup();
    c.enqueue('volume_up');
    c.enqueue('volume_up');
    await bar.fail(networkError());
    expect(c.getSnapshot().queue).toEqual([]);
    expect(c.getSnapshot().online).toBe(false);
    expect(c.getSnapshot().feedback.text).toMatch(/pending taps were cleared/);
    expect(bar.sent).toHaveLength(1);
  });

  test('a rejected action shows the bar message and adopts its state', async () => {
    const {bar, c} = await setup();
    c.enqueue('mute');
    await bar.fail(new BarError('rejected', 'Turn on the bar first', 409, baseState({revision: 9, muted: false, volume: 4})));
    const s = c.getSnapshot();
    expect(s.feedback).toMatchObject({text: 'Turn on the bar first', kind: 'error'});
    expect(s.state?.volume).toBe(4);
    expect(s.online).toBe(true);
  });
});

describe('planned volume transactions', () => {
  test('10 → 25 is 15 sequential confirmed steps with progress', async () => {
    const {bar, c} = await setup();
    expect(c.setVolume(25)).toBe(15);
    expect(bar.sent).toHaveLength(1);
    expect(c.getSnapshot().feedback.text).toBe('Setting volume 25… (1 of 15)');
    for (let i = 0; i < 6; i++) await bar.complete();
    expect(c.getSnapshot().feedback.text).toBe('Setting volume 25… (7 of 15)');
    expect(bar.pending).toHaveLength(1); // never parallel
    for (let i = 0; i < 9; i++) await bar.complete();
    expect(bar.sent).toHaveLength(15);
    expect(c.getSnapshot().state?.volume).toBe(25);
    expect(c.getSnapshot().volumePlan).toBeNull();
  });

  test('plans bypass the tap cap and go down too', async () => {
    const {bar, c} = await setup(baseState({volume: 30}));
    expect(c.setVolume(0)).toBe(30);
    expect(c.getSnapshot().queue).toHaveLength(29);
    expect(bar.sent[0].action).toBe('volume_down');
  });

  test('clear queued taps cancels a plan, the in-flight step finishes', async () => {
    const {bar, c} = await setup();
    c.setVolume(20);
    await bar.complete();
    c.cancelQueued();
    expect(c.getSnapshot().queue).toEqual([]);
    expect(c.getSnapshot().feedback.text).toBe('Queued taps cleared. Finishing the current step…');
    await bar.complete();
    expect(bar.sent).toHaveLength(2);
    expect(c.getSnapshot().state?.volume).toBe(12);
  });

  test('retargeting while a step runs accounts for the in-flight step', async () => {
    const {bar, c} = await setup();
    c.setVolume(15); // up in flight, 4 queued
    c.setVolume(12); // base = 11 after in-flight lands → 1 more
    expect(c.getSnapshot().queue).toEqual(['volume_up']);
    await bar.complete();
    await bar.complete();
    expect(c.getSnapshot().state?.volume).toBe(12);
  });

  test('same target is a no-op', async () => {
    const {bar, c} = await setup();
    expect(c.setVolume(10)).toBe(0);
    expect(bar.sent).toHaveLength(0);
  });
});

describe('state ordering and sessions', () => {
  test('stale revisions are ignored', async () => {
    const {bar, c} = await setup(baseState({revision: 5}));
    bar.push(baseState({revision: 4, volume: 2}));
    expect(c.getSnapshot().state?.volume).toBe(10);
    bar.push(baseState({revision: 6, volume: 3}));
    expect(c.getSnapshot().state?.volume).toBe(3);
  });

  test('a new csrf clears the queue and refetches features', async () => {
    const {bar, c} = await setup(baseState({revision: 50}));
    c.enqueue('volume_up');
    c.enqueue('volume_up');
    await bar.complete();
    // Bar restarted: lower revision but new session must still be adopted.
    const session = c.getSnapshot().session;
    bar.push(baseState({revision: 1, csrf: 'session-b'}));
    // The second tap is in flight; the stream state waits for it.
    await bar.complete();
    const s = c.getSnapshot();
    expect(s.csrf).toBe('session-b');
    expect(s.session).toBe(session + 1);
    expect(s.queue).toEqual([]);
  });

  test('states arriving mid-action are applied after it finishes', async () => {
    const {bar, c} = await setup();
    c.enqueue('mute');
    bar.push(baseState({revision: 100, volume: 7, muted: true}));
    expect(c.getSnapshot().state?.volume).toBe(10);
    await bar.complete();
    expect(c.getSnapshot().state?.volume).toBe(7);
  });
});

describe('busy gate', () => {
  test('another client holding the bar disables controls after the grace period', async () => {
    const {bar, c} = await setup();
    bar.push(baseState({revision: 2, control: {busy: true}}));
    expect(c.getSnapshot().ready).toBe(true);
    clock += BUSY_DELAY;
    jest.advanceTimersByTime(BUSY_DELAY);
    expect(c.getSnapshot().ready).toBe(false);
    expect(c.getSnapshot().elsewhere).toBe(true);
    bar.push(baseState({revision: 3, control: {busy: false}}));
    expect(c.getSnapshot().ready).toBe(true);
  });

  test('short background work never shows as busy', async () => {
    const {bar, c} = await setup();
    bar.push(baseState({revision: 2, control: {busy: true}}));
    clock += 300;
    bar.push(baseState({revision: 3, control: {busy: false}}));
    clock += 1000;
    jest.advanceTimersByTime(1000);
    expect(c.getSnapshot().elsewhere).toBe(false);
  });

  test('our own action does not count as elsewhere', async () => {
    const {bar, c} = await setup();
    c.enqueue('power');
    bar.state = baseState({control: {busy: true}});
    await bar.complete();
    expect(c.getSnapshot().elsewhere).toBe(false);
  });
});

describe('connection', () => {
  test('stream errors clear pending taps and reconnect', async () => {
    const {bar, c} = await setup();
    c.enqueue('volume_up');
    c.enqueue('volume_up');
    bar.stream.handlers.onError();
    expect(c.getSnapshot().online).toBe(false);
    expect(c.getSnapshot().queue).toEqual([]);
    expect(bar.streams).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    expect(bar.streams).toHaveLength(2);
    expect(bar.streams[0].closed).toBe(true);
  });

  test('a silent stream is treated as lost', async () => {
    const {bar, c} = await setup();
    jest.advanceTimersByTime(30000);
    expect(bar.streams[0].closed).toBe(true);
    expect(c.getSnapshot().online).toBe(false);
  });

  test('pause closes the stream; resume reconnects', async () => {
    const {bar, c} = await setup();
    c.pause();
    expect(bar.streams[0].closed).toBe(true);
    c.resume();
    expect(bar.streams).toHaveLength(2);
  });

  test('a 403 on state is reported as wrong network', async () => {
    const bar = new FakeBar();
    bar.stateError = new BarError('forbidden', 'Forbidden', 403);
    const c = new Controller({host: 'x', api: bar.api(), stream: bar.streamFactory, now: () => clock});
    await c.start();
    await flush();
    expect(c.getSnapshot().lastError?.kind).toBe('forbidden');
    expect(c.getSnapshot().feedback.text).toMatch(/192\.168\.100/);
  });
});

describe('segments and modes', () => {
  test('choosing a level runs the steps that reach it, wrapping', async () => {
    const {bar, c} = await setup(); // bass 2 (level 3)
    expect(c.choose('bass', 1)).toBe(4);
    expect(c.getSnapshot().targets.bass).toBe(1);
    for (let i = 0; i < 4; i++) await bar.complete();
    expect(bar.sent.every(b => b.action === 'bass_next')).toBe(true);
    expect(c.getSnapshot().state?.sound?.bass).toBe(1);
    expect(c.getSnapshot().targets.bass).toBeUndefined();
  });

  test('center uses the extension action', async () => {
    const {bar, c} = await setup();
    c.choose('center', 2);
    expect(bar.sent[0]).toEqual({action: 'bar91.center-level.next'});
  });

  test('mode select is one step, none when already selected', async () => {
    const {bar, c} = await setup();
    expect(c.choose('mode', 'Standard')).toBe(0);
    expect(c.choose('mode', 'Smart')).toBe(1);
    expect(bar.sent[0]).toEqual({action: 'smart'});
  });

  test('segments refuse while anything is pending', async () => {
    const {c} = await setup();
    c.enqueue('mute');
    expect(c.choose('bass', 4)).toBe(0);
  });

  test('cycleSteps', () => {
    expect(cycleSteps(0, 0, 5)).toBe(0);
    expect(cycleSteps(4, 0, 5)).toBe(1);
    expect(cycleSteps(2, 1, 5)).toBe(4);
    expect(cycleSteps(undefined, 1, 5)).toBe(0);
    expect(cycleSteps(1, 5, 5)).toBe(0);
  });
});

describe('audio sync', () => {
  test('taps wait until they stop, then send one av_sync_set', async () => {
    const {bar, c} = await setup();
    c.enqueue('av_sync_up');
    c.enqueue('av_sync_up');
    c.enqueue('av_sync_up');
    expect(c.getSnapshot().avSyncDraft).toBe(30);
    expect(bar.sent).toHaveLength(0);
    jest.advanceTimersByTime(900);
    expect(bar.sent).toEqual([{action: 'av_sync_set', value: 30}]);
  });

  test('a typed value goes at once, snapped to 10 ms and clamped', async () => {
    const {bar, c} = await setup();
    c.setAvSync(87, true);
    jest.advanceTimersByTime(0);
    expect(bar.sent).toEqual([{action: 'av_sync_set', value: 90}]);
  });

  test('typing the current value sends nothing', async () => {
    const {bar, c} = await setup();
    expect(c.setAvSync(0, true)).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(bar.sent).toHaveLength(0);
  });
});

describe('hold to repeat', () => {
  test('repeats after 400 ms, every 180 ms, only when the queue is empty', async () => {
    const {bar, c} = await setup();
    bar.auto = true;
    c.startHold('volume_up');
    await flush();
    expect(bar.sent).toHaveLength(1);
    jest.advanceTimersByTime(399);
    await flush();
    expect(bar.sent).toHaveLength(1);
    jest.advanceTimersByTime(1 + 180);
    await flush();
    expect(bar.sent).toHaveLength(2);
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(180);
      await flush();
    }
    expect(bar.sent).toHaveLength(5);
    c.stopHold();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(bar.sent).toHaveLength(5);
  });
});

describe('capabilities', () => {
  test('maps bound actions onto included extensions', () => {
    expect(command(FEATURES, 'eq_apply', {gains: [-1, 0, 0, 0, 0]})).toEqual({action: 'bar91.front-eq.apply', parameters: {gains_db: [-1, 0, 0, 0, 0]}});
    expect(command(FEATURES, 'bass_offset_set', {parameters: {offset_db: 1.5}})).toEqual({action: 'bar91.bass-offset.set', parameters: {offset_db: 1.5}});
    expect(command(null, 'eq_apply', {gains: [0, 0, 0, 0, 0]})).toEqual({action: 'eq_apply', gains_db: [0, 0, 0, 0, 0]});
    expect(command(FEATURES, 'av_sync_set', {value: 40})).toEqual({action: 'av_sync_set', value: 40});
  });

  test('projects extension state', () => {
    const s = project(FEATURES, baseState({extensions: {'bar91.center-level': {level: 3, error: ''}, 'bar91.bass-offset': {offset_db: 1}}}));
    expect(s.sound?.center).toBe(3);
    expect(s.bass_offset?.offset_db).toBe(1);
  });

  test('unsupported actions are disabled', () => {
    expect(supports(FEATURES, 'mute')).toBe(true);
    expect(supports({...FEATURES, actions: ['volume_up']}, 'mute')).toBe(false);
    expect(supports(null, 'anything')).toBe(true);
  });

  test('manual picks the phone language, then English', () => {
    expect(manual(FEATURES, ['fr-FR'])?.code).toBe('en');
    expect(manual({...FEATURES, manuals: {fr: 'https://x/fr.pdf', en: 'https://x/en.pdf'}}, ['fr-FR'])?.label).toBe('PDF · Français');
    expect(manual({...FEATURES, manuals: {en: 'http://insecure'}}, ['en'])).toBeNull();
  });
});

describe('format', () => {
  test('snap and parse', () => {
    expect(snap(-2.3, -6, 0, 0.5)).toBe(-2.5);
    expect(snap(7, -6, 0, 0.5)).toBe(0);
    expect(snap(87, 0, 250, 10)).toBe(90);
    expect(snap(-0.1, -3, 3, 0.5)).toBe(0);
    expect(parseTyped('−2,5')).toBe(-2.5);
    expect(parseTyped('40 ms')).toBe(40);
    expect(parseTyped('abc')).toBeNull();
    expect(parseTyped('')).toBeNull();
  });

  test('rates, uptime, gains', () => {
    expect(rate(512)).toBe('512 B/s');
    expect(rate(2048)).toBe('2 KiB/s');
    expect(rate(1572864)).toBe('1.5 MiB/s');
    expect(uptime(297024)).toBe('3d 10h 30m');
    expect(uptime(42)).toBe('42s');
    expect(eqGain(-1.5)).toBe('-1.5 dB');
    expect(eqGain(0)).toBe('0 dB');
  });
});

describe('stream that never opens', () => {
  test('is retried after the watchdog', async () => {
    const bar = new FakeBar();
    const c = new Controller({host: 'x', api: bar.api(), stream: bar.streamFactory, now: () => clock});
    await c.start();
    await flush();
    expect(bar.streams).toHaveLength(1);
    jest.advanceTimersByTime(30000);
    expect(bar.streams[0].closed).toBe(true);
    jest.advanceTimersByTime(1000);
    expect(bar.streams).toHaveLength(2);
  });
});
