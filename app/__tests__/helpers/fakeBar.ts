import {BarError, type Api} from '../../src/api/client';
import type {ActionBody, BarState, Features} from '../../src/api/types';
import type {StreamFactory, StreamHandlers} from '../../src/engine/controller';

export function baseState(overrides: Partial<BarState> = {}): BarState {
  return {
    available: true,
    power: 'On',
    mode: 'Standard',
    volume: 10,
    muted: false,
    input: 'TV / ARC',
    source_state: 0,
    sound: {bass: 2, atmos: 1, rear: 1, rear_docked: false, rear_battery_left: 80, rear_battery_right: 75, night: false, center: 0, av_sync_ms: 0},
    control: {busy: false},
    revision: 1,
    csrf: 'session-a',
    ...overrides,
  };
}

export const FEATURES: Features = {
  schema: 1,
  model: 'bar91',
  name: 'JBL Bar 9.1',
  actions: ['volume_up', 'volume_down', 'mute', 'power', 'standard', 'smart', 'night_toggle', 'av_sync_set', 'calibrate', 'sub_pair', 'input_tv', 'input_hdmi', 'input_bluetooth', 'bluetooth_pair', 'bass_next', 'atmos_next', 'rear_next', 'media_play', 'media_pause', 'media_stop', 'media_previous', 'media_next', 'center_next', 'eq_apply', 'eq_reset'],
  extensions: [
    {id: 'bar91.bass-offset', component: 'bass-offset', included: true, experimental: true, actions: ['bar91.bass-offset.set']},
    {id: 'bar91.center-level', component: 'center-level', included: true, experimental: true, actions: ['bar91.center-level.next']},
    {id: 'bar91.front-eq', component: 'front-eq', included: true, experimental: true, actions: ['bar91.front-eq.apply', 'bar91.front-eq.reset']},
  ],
  manuals: {en: 'https://example.com/en.pdf'},
};

interface Pending {
  body: ActionBody;
  resolve: (s: BarState) => void;
  reject: (e: Error) => void;
}

// A scriptable bar: actions wait until the test resolves them, so ordering
// and single-flight behaviour can be asserted step by step.
export class FakeBar {
  state: BarState;
  features: Features | null = FEATURES;
  sent: ActionBody[] = [];
  pending: Pending[] = [];
  auto = false;
  stateError: Error | null = null;
  streams: {url: string; handlers: StreamHandlers; closed: boolean}[] = [];

  constructor(state = baseState()) {
    this.state = state;
  }

  apply(action: string) {
    const s = {...this.state, sound: {...this.state.sound}, revision: (this.state.revision ?? 0) + 1};
    if (action === 'volume_up') s.volume = Math.min(31, (s.volume ?? 0) + 1);
    if (action === 'volume_down') s.volume = Math.max(0, (s.volume ?? 0) - 1);
    if (action === 'mute') s.muted = !s.muted;
    if (action === 'bass_next') s.sound!.bass = ((s.sound!.bass ?? 0) + 1) % 5;
    if (action === 'atmos_next') s.sound!.atmos = ((s.sound!.atmos ?? 0) + 1) % 3;
    if (action === 'rear_next') s.sound!.rear = ((s.sound!.rear ?? 0) + 1) % 4;
    if (action === 'smart') s.mode = 'Smart';
    if (action === 'standard') s.mode = 'Standard';
    this.state = s;
    return s;
  }

  api(): Api {
    return {
      host: '192.168.100.25',
      getState: async () => {
        if (this.stateError) throw this.stateError;
        return this.state;
      },
      getFeatures: async () => this.features,
      postAction: (body: ActionBody) => {
        this.sent.push(body);
        if (this.auto) return Promise.resolve(this.apply(body.action));
        return new Promise<BarState>((resolve, reject) => this.pending.push({body, resolve, reject}));
      },
      eventsUrl: () => 'http://192.168.100.25/api/events',
    };
  }

  // Completes the oldest in-flight action using the simulated bar.
  async complete() {
    const next = this.pending.shift();
    if (!next) throw new Error('nothing in flight');
    next.resolve(this.apply(next.body.action));
    await flush();
  }

  async fail(error: Error) {
    const next = this.pending.shift();
    if (!next) throw new Error('nothing in flight');
    next.reject(error);
    await flush();
  }

  streamFactory: StreamFactory = (url, handlers) => {
    const entry = {url, handlers, closed: false};
    this.streams.push(entry);
    return {close: () => { entry.closed = true; }};
  };

  get stream() {
    return this.streams[this.streams.length - 1];
  }

  push(s: BarState) {
    this.stream.handlers.onMessage(JSON.stringify(s));
  }
}

export async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

export const networkError = () => new BarError('network', 'Network request failed');
