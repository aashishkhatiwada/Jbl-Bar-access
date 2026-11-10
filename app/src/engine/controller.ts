import {BarError, createApi, type Api} from '../api/client';
import type {BarState, Features} from '../api/types';
import {command, deviceName, project} from './capabilities';
import {cycleSteps, LEVELS, type LevelName} from './segments';
import {PlaybackIntent} from './playback';
import {successMessage, pendingMessage} from './messages';

// One capability discovery request, one state stream, one serialized action
// queue. A port of the web remote's app.js: same rules, same wording, so the
// phone and the browser behave identically.

export const MAX_QUEUED_TAPS = 8;
export const BUSY_DELAY = 800;
export const HOLD_DELAY = 400;
export const HOLD_REPEAT = 180;
export const SYNC_TAP_DELAY = 900;
export const AV_SYNC_MAX = 250;
export const STREAM_WATCHDOG = 30000;
export const POLL_INTERVAL = 5000;
export const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

export type FeedbackKind = '' | 'pending' | 'success' | 'error';
export interface Feedback {
  text: string;
  kind: FeedbackKind;
  seq: number;
}

export interface QueueItem {
  action: string;
  payload?: {gains?: number[]; parameters?: Record<string, unknown>};
}

export interface VolumePlan {
  target: number;
  total: number;
}

export interface StreamHandlers {
  onOpen(): void;
  onMessage(data: string): void;
  onError(): void;
}
export interface StreamHandle {
  close(): void;
}
export type StreamFactory = (url: string, handlers: StreamHandlers) => StreamHandle;

export interface Snapshot {
  host: string;
  raw: BarState | null;
  state: BarState | null; // with extensions projected onto core fields
  features: Features | null;
  deviceName: string;
  online: boolean;
  reachable: boolean;
  ready: boolean;
  elsewhere: boolean; // another client holds the bar past the grace period
  awake: boolean;
  active: string | null;
  queue: string[];
  pending: string[];
  csrf: string;
  feedback: Feedback;
  streamOpen: boolean;
  lastSync: number;
  refreshing: boolean;
  avSyncDraft: number | null;
  volumePlan: VolumePlan | null;
  pendingVolume: number;
  targets: Partial<Record<LevelName, number>>;
  holding: string | null;
  session: number; // increments when the bar session (csrf) changes
  everConnected: boolean;
  lastError: BarError | null;
}

const isVolume = (action: string | null | undefined) => action === 'volume_up' || action === 'volume_down';
const delta = (action: string | null | undefined) => (action === 'volume_up' ? 1 : action === 'volume_down' ? -1 : 0);
const versioned = (s: BarState | null | undefined): boolean => Number.isSafeInteger(s?.revision) && (s!.revision as number) >= 0;

export interface ControllerOptions {
  host: string;
  stream?: StreamFactory;
  fetcher?: typeof fetch;
  now?: () => number;
  api?: Api;
}

export class Controller {
  private api: Api;
  private streamFactory?: StreamFactory;
  private now: () => number;
  private listeners = new Set<() => void>();
  private snap!: Snapshot;

  features: Features | null = null;
  current: BarState | null = null;
  csrf = '';
  online = false;
  active: string | null = null;
  activeItem: QueueItem | null = null;
  queue: QueueItem[] = [];
  epoch = 0;
  refreshing = false;
  latestState: BarState | null = null;
  lastSync = 0;
  feedback: Feedback = {text: 'Connecting to the soundbar.', kind: '', seq: 0};
  avSyncDraft: number | null = null;
  volumePlan: VolumePlan | null = null;
  targets: Partial<Record<LevelName, number>> = {};
  session = 0;
  everConnected = false;
  lastError: BarError | null = null;
  playback = new PlaybackIntent();

  private stream: StreamHandle | null = null;
  private streamOpen = false;
  private paused = true;
  private disposed = false;
  private busySince: number | null = null;
  private busyTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private repeatTimer: ReturnType<typeof setInterval> | null = null;
  private held: string | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ControllerOptions) {
    this.api = options.api || createApi(options.host, options.fetcher);
    this.streamFactory = options.stream;
    this.now = options.now || Date.now;
    this.snap = this.build();
  }

  // ---- subscription -------------------------------------------------------
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snap;
  private emit() {
    if (this.disposed) return;
    this.snap = this.build();
    for (const listener of this.listeners) listener();
  }

  get host() {
    return this.api.host;
  }

  // ---- readiness ------------------------------------------------------------
  // A control sent from elsewhere (another page, Home Assistant, the wake
  // automation) holds the bar: wait for it like for one of ours. Background
  // work that ends within BUSY_DELAY is not shown, so controls do not flash.
  private readiness() {
    const reachable = this.online && !!this.current?.available;
    const busy = reachable && !!this.current?.control?.busy && this.active === null;
    if (!busy) {
      this.busySince = null;
      if (this.busyTimer) {
        clearTimeout(this.busyTimer);
        this.busyTimer = null;
      }
    } else if (this.busySince === null) {
      this.busySince = this.now();
      this.busyTimer = setTimeout(() => {
        this.busyTimer = null;
        this.emit();
      }, BUSY_DELAY);
    }
    const elsewhere = busy && this.busySince !== null && this.now() - this.busySince >= BUSY_DELAY;
    return {reachable, elsewhere, ready: reachable && !elsewhere};
  }

  pendingVolume(): number {
    return (this.active ? delta(this.active) : 0) + this.queue.reduce((n, item) => n + delta(item.action), 0);
  }

  private build(): Snapshot {
    const {reachable, elsewhere, ready} = this.readiness();
    const queue = this.queue.map(item => item.action);
    const pending = this.active ? [this.active, ...queue] : queue;
    const state = project(this.features, this.current);
    // A segment target stays shown only while its steps are running or queued.
    for (const name of Object.keys(this.targets) as LevelName[]) {
      const value = state?.sound?.[name];
      if (this.targets[name] === value || !pending.includes(LEVELS[name].action)) delete this.targets[name];
    }
    if (this.volumePlan && !pending.some(isVolume)) this.volumePlan = null;
    return {
      host: this.api.host,
      raw: this.current,
      state,
      features: this.features,
      deviceName: deviceName(this.features),
      online: this.online,
      reachable,
      ready,
      elsewhere,
      awake: this.current?.power === 'On',
      active: this.active,
      queue,
      pending,
      csrf: this.csrf,
      feedback: this.feedback,
      streamOpen: this.streamOpen,
      lastSync: this.lastSync,
      refreshing: this.refreshing,
      avSyncDraft: this.avSyncDraft,
      volumePlan: this.volumePlan ? {...this.volumePlan} : null,
      pendingVolume: this.pendingVolume(),
      targets: {...this.targets},
      holding: this.held,
      session: this.session,
      everConnected: this.everConnected,
      lastError: this.lastError,
    };
  }

  private setFeedback(text: string, kind: FeedbackKind = '') {
    this.feedback = {text, kind, seq: this.feedback.seq + 1};
  }

  // ---- state adoption -----------------------------------------------------------
  private settingsChanged(s: BarState): boolean {
    const c = this.current;
    return !!c && ((['volume', 'muted', 'power', 'input', 'mode'] as const).some(key => c[key] !== s[key]) || JSON.stringify(c.sound) !== JSON.stringify(s.sound));
  }

  // Ignores snapshots older than the one shown, unless they carry a new
  // session. Returns false when the snapshot was stale.
  adopt(s: BarState): boolean {
    if (versioned(this.current) && versioned(s) && (s.revision as number) < (this.current!.revision as number) && (!s.csrf || s.csrf === this.csrf)) return false;
    const newSession = !!this.csrf && !!s.csrf && this.csrf !== s.csrf;
    this.current = s;
    this.csrf = s.csrf || this.csrf;
    this.online = true;
    this.everConnected = true;
    this.lastError = null;
    this.lastSync = this.now();
    if (newSession) {
      this.queue = [];
      this.volumePlan = null;
      this.stopHold();
      this.clearSyncDraft();
      this.playback.reset();
      this.session++;
      void this.loadFeatures().then(() => this.emit());
    }
    return true;
  }

  receiveState(s: BarState) {
    if (this.active) {
      const latest = this.latestState;
      if (!latest || !versioned(s) || !versioned(latest) || (s.revision as number) >= (latest.revision as number) || s.csrf !== latest.csrf) this.latestState = s;
      return;
    }
    const reconnecting = !this.online || !this.current?.available;
    const changed = this.settingsChanged(s);
    if (!this.adopt(s)) return;
    if (!s.available) this.setFeedback(s.error || 'Waiting for your soundbar…', 'error');
    else if (reconnecting) this.setFeedback('Ready. Your settings update live.');
    else if (changed && this.feedback.kind === 'success') this.setFeedback('Settings updated from the soundbar.');
    this.emit();
  }

  // ---- lifecycle ------------------------------------------------------------
  async start() {
    this.paused = false;
    await this.loadFeatures();
    this.connectStream();
    void this.refresh();
    this.emit();
  }

  private async loadFeatures() {
    const value = await this.api.getFeatures();
    if (value) this.features = value;
  }

  // App went to the background: close the stream like a hidden web page.
  pause() {
    this.paused = true;
    this.stopHold();
    this.closeStream();
    this.stopPolling();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.emit();
  }

  resume() {
    if (this.disposed) return;
    this.paused = false;
    this.connectStream();
    void this.refresh();
  }

  dispose() {
    this.pause();
    this.clearSyncDraft();
    if (this.busyTimer) clearTimeout(this.busyTimer);
    this.disposed = true;
    this.listeners.clear();
  }

  // ---- stream ----------------------------------------------------------------
  private closeStream() {
    const stream = this.stream;
    this.stream = null;
    this.streamOpen = false;
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
    stream?.close();
  }

  private armWatchdog(handle: StreamHandle) {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (this.stream === handle) this.streamFailed(handle);
    }, STREAM_WATCHDOG);
  }

  connectStream() {
    if (this.stream || this.paused || !this.streamFactory) return;
    let handle: StreamHandle | null = null;
    const handlers: StreamHandlers = {
      onOpen: () => {
        if (this.stream !== handle) return;
        this.streamOpen = true;
        this.reconnectAttempt = 0;
        this.stopPolling();
        this.armWatchdog(handle!);
        this.emit();
      },
      onMessage: data => {
        if (this.stream !== handle) return;
        this.streamOpen = true;
        this.armWatchdog(handle!);
        try {
          this.receiveState(JSON.parse(data));
        } catch {
          this.setFeedback('Unable to read live state. Refresh to reconnect.', 'error');
          this.emit();
        }
      },
      onError: () => {
        if (this.stream !== handle) return;
        this.streamFailed(handle!);
      },
    };
    handle = this.streamFactory(this.api.eventsUrl(), handlers);
    this.stream = handle;
    // Also covers a connection that never opens.
    this.armWatchdog(handle);
  }

  private streamFailed(handle: StreamHandle) {
    if (this.stream !== handle) return;
    this.closeStream();
    this.online = false;
    this.queue = [];
    this.volumePlan = null;
    this.latestState = null;
    this.playback.reset();
    this.stopHold();
    this.clearSyncDraft();
    this.setFeedback('Live connection lost. Reconnecting; pending taps were cleared.', 'error');
    this.emit();
    this.scheduleReconnect();
    this.startPolling();
  }

  private scheduleReconnect() {
    if (this.paused || this.reconnectTimer) return;
    const wait = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectStream();
    }, wait);
  }

  // Polling fallback while the stream is down, so "Synced N s ago" stays true.
  private startPolling() {
    if (this.pollTimer || this.paused) return;
    this.pollTimer = setInterval(() => {
      if (this.streamOpen) this.stopPolling();
      else void this.refresh();
    }, POLL_INTERVAL);
  }

  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // ---- refresh ---------------------------------------------------------------
  async refresh() {
    if (this.refreshing || this.active || this.paused) return;
    const version = this.epoch;
    this.refreshing = true;
    this.emit();
    try {
      const s = await this.api.getState();
      if (version !== this.epoch || this.active) return;
      const reconnecting = !this.online || !this.current?.available;
      const changed = this.settingsChanged(s);
      this.adopt(s);
      if (changed && this.feedback.kind === 'success') this.setFeedback('Settings updated from the soundbar.');
      if (!s.available) this.setFeedback(s.error || 'Waiting for your soundbar…', 'error');
      else if (reconnecting) this.setFeedback('Ready. Your settings update live.');
    } catch (error) {
      if (version !== this.epoch || this.active) return;
      this.online = false;
      this.lastError = error instanceof BarError ? error : new BarError('network', String(error));
      this.playback.reset();
      this.queue = [];
      this.volumePlan = null;
      this.clearSyncDraft();
      this.stopHold();
      this.setFeedback(this.lastError.kind === 'forbidden'
        ? 'The soundbar refused this phone. Join the soundbar’s Wi-Fi network (192.168.100.x).'
        : 'Connection lost. Reconnecting automatically; no controls will be replayed.', 'error');
      if (!this.streamOpen) {
        this.startPolling();
        this.scheduleReconnect();
      }
    } finally {
      this.refreshing = false;
      this.emit();
    }
  }

  // Manual refresh button: reconnect the stream and fetch now.
  manualRefresh() {
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectStream();
    void this.refresh();
  }

  // ---- actions -------------------------------------------------------------------
  private canSend(): boolean {
    return !!this.csrf && this.online;
  }

  // A tap on an ordinary control. Volume taps coalesce (opposite pending taps
  // cancel) and are capped at MAX_QUEUED_TAPS.
  enqueue(action: string, payload?: QueueItem['payload']): boolean {
    if (!this.csrf) return false;
    if (action === 'av_sync_up' || action === 'av_sync_down') {
      this.avSyncTap(action);
      return true;
    }
    this.clearSyncDraft();
    const last = this.queue[this.queue.length - 1];
    if (isVolume(action) && last && delta(last.action) === -delta(action)) {
      this.queue.pop();
      if (this.volumePlan) this.volumePlan.total--;
    } else if (this.queue.length < MAX_QUEUED_TAPS) this.queue.push({action, payload});
    else {
      this.setFeedback('Let the pending volume changes finish first.', 'pending');
      this.emit();
      return false;
    }
    if (this.active) {
      this.setFeedback(this.pendingText(), 'pending');
      this.emit();
    } else void this.pump();
    return true;
  }

  // A slider or typed volume: one planned transaction of sequential confirmed
  // steps. Bypasses the tap cap but never runs in parallel.
  setVolume(target: number): number {
    const volume = this.current?.volume;
    if (!this.csrf || typeof volume !== 'number') return 0;
    if (this.active && !isVolume(this.active)) return 0;
    if (this.queue.some(item => !isVolume(item.action))) return 0;
    this.clearSyncDraft();
    const clamped = Math.max(0, Math.min(31, Math.round(target)));
    // Replace queued volume taps with the plan; the active step still lands.
    this.queue = [];
    const base = volume + (this.active ? delta(this.active) : 0);
    const steps = clamped - base;
    if (steps === 0) {
      this.volumePlan = null;
      this.emit();
      return 0;
    }
    const action = steps > 0 ? 'volume_up' : 'volume_down';
    for (let i = 0; i < Math.abs(steps); i++) this.queue.push({action});
    this.volumePlan = {target: clamped, total: Math.abs(steps)};
    if (this.active) {
      this.setFeedback(this.pendingText(), 'pending');
      this.emit();
    } else void this.pump();
    return Math.abs(steps);
  }

  // A segment (level or mode) becomes the confirmed steps that reach it.
  choose(kind: LevelName | 'mode', value: number | string): number {
    if (!this.csrf || this.active || this.queue.length) return 0;
    this.clearSyncDraft();
    const state = project(this.features, this.current);
    let steps = 0;
    let action = '';
    if (kind === 'mode') {
      action = value === 'Smart' ? 'smart' : 'standard';
      steps = state?.mode === value ? 0 : 1;
    } else {
      const level = LEVELS[kind];
      action = level.action;
      steps = cycleSteps(state?.sound?.[kind], Number(value), level.count);
      if (steps) this.targets[kind] = Number(value);
    }
    if (!steps) return 0;
    for (let i = 0; i < steps; i++) this.queue.push({action});
    void this.pump();
    return steps;
  }

  cancelQueued() {
    const hadActive = !!this.active;
    this.queue = [];
    this.volumePlan = null;
    this.clearSyncDraft();
    this.stopHold();
    this.setFeedback(hadActive ? 'Queued taps cleared. Finishing the current step…' : 'Queued taps cleared.', hadActive ? 'pending' : '');
    this.emit();
  }

  // ---- hold to repeat (volume) --------------------------------------------------------
  startHold(action: 'volume_up' | 'volume_down') {
    this.stopHold();
    this.held = action;
    this.enqueue(action);
    this.holdTimer = setTimeout(() => {
      this.repeatTimer = setInterval(() => {
        if (this.queue.length < 1 && this.held === action) this.enqueue(action);
      }, HOLD_REPEAT);
    }, HOLD_DELAY);
    this.emit();
  }

  stopHold() {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    if (this.repeatTimer) clearInterval(this.repeatTimer);
    this.holdTimer = null;
    this.repeatTimer = null;
    const was = this.held;
    this.held = null;
    if (was) this.emit();
  }

  // ---- audio sync draft ------------------------------------------------------------
  clearSyncDraft() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
    this.avSyncDraft = null;
  }

  private submitSync(delay: number) {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      if (!this.online || this.active || this.avSyncDraft === this.current?.sound?.av_sync_ms) {
        this.avSyncDraft = null;
        this.emit();
        return;
      }
      if (!this.queue.some(item => item.action === 'av_sync_set')) this.queue.push({action: 'av_sync_set'});
      void this.pump();
    }, delay);
    this.emit();
  }

  private avSyncTap(action: 'av_sync_up' | 'av_sync_down') {
    const base = this.avSyncDraft ?? this.current?.sound?.av_sync_ms;
    if (!Number.isInteger(base)) return;
    this.avSyncDraft = Math.max(0, Math.min(AV_SYNC_MAX, (base as number) + (action === 'av_sync_up' ? 10 : -10)));
    this.submitSync(SYNC_TAP_DELAY);
    this.setFeedback('Audio sync ' + this.avSyncDraft + ' ms · sending when you stop tapping…', 'pending');
    this.emit();
  }

  // Slider drags wait like taps; a typed or released value goes at once.
  setAvSync(value: number, immediate: boolean): boolean {
    if (!this.csrf || this.active) return false;
    const sync = this.current?.sound?.av_sync_ms;
    if (!Number.isInteger(sync)) return false;
    const clamped = Math.max(0, Math.min(AV_SYNC_MAX, Math.round(value / 10) * 10));
    this.avSyncDraft = clamped === sync ? null : clamped;
    if (this.avSyncDraft === null) {
      if (this.syncTimer) clearTimeout(this.syncTimer);
      this.syncTimer = null;
      this.emit();
      return false;
    }
    this.submitSync(immediate ? 0 : SYNC_TAP_DELAY);
    if (!immediate) this.setFeedback('Audio sync ' + this.avSyncDraft + ' ms · sending when you stop…', 'pending');
    this.emit();
    return true;
  }

  // ---- the pump --------------------------------------------------------------------
  private pendingText(): string {
    const remainingVolume = this.queue.filter(item => isVolume(item.action)).length;
    return pendingMessage(this.active, {
      queued: this.queue.length,
      syncTarget: this.avSyncDraft,
      plan: this.volumePlan && isVolume(this.active) ? {target: this.volumePlan.target, step: this.volumePlan.total - remainingVolume, total: this.volumePlan.total} : null,
    });
  }

  async pump(): Promise<void> {
    if (this.active || !this.queue.length || !this.online) return;
    const item = this.queue.shift()!;
    this.active = item.action;
    this.activeItem = item;
    const action = item.action;
    const syncTarget = action === 'av_sync_set' ? this.avSyncDraft : null;
    this.epoch++;
    this.setFeedback(this.pendingText(), 'pending');
    this.emit();
    const requestPeer = PlaybackIntent.identity(this.current);
    try {
      const body = command(this.features, action, {gains: item.payload?.gains, value: syncTarget, parameters: item.payload?.parameters});
      let data: BarState;
      try {
        data = await this.api.postAction(body, this.csrf);
      } catch (error) {
        if (error instanceof BarError && error.state) this.adopt(error.state);
        throw error;
      }
      this.adopt(data);
      if (!data.available) throw new BarError('rejected', data.error || 'Soundbar unavailable.');
      this.playback.accepted(action, requestPeer, data);
      this.setFeedback(successMessage(action, project(this.features, data), deviceName(this.features)), 'success');
    } catch (error: any) {
      this.queue = [];
      this.volumePlan = null;
      this.clearSyncDraft();
      this.stopHold();
      if (error instanceof BarError && error.connectionLost) {
        this.online = false;
        this.playback.reset();
        this.setFeedback('Connection interrupted. The last change may have applied; pending taps were cleared.', 'error');
      } else this.setFeedback(error?.message || 'Control unavailable.', 'error');
    } finally {
      if (action === 'av_sync_set') this.clearSyncDraft();
      this.active = null;
      this.activeItem = null;
      this.emit();
      if (this.latestState) {
        const next = this.latestState;
        this.latestState = null;
        this.receiveState(next);
      }
      if (this.queue.length && this.online) void this.pump();
    }
  }
}
