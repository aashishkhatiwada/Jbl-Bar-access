import type {ActionBody, BarState, Features} from './types';

// Timeouts match the web client: state 8 s, features 4 s, actions 30 s,
// audio sync 70 s (about a second per 10 ms step), EQ 35 s.
export const TIMEOUTS = {state: 8000, features: 4000, action: 30000, avSync: 70000, eq: 35000};

export function actionTimeout(action: string): number {
  if (action === 'av_sync_set') return TIMEOUTS.avSync;
  if (action.startsWith('eq_') || action.startsWith('bar91.front-eq')) return TIMEOUTS.eq;
  return TIMEOUTS.action;
}

export type FailureKind = 'network' | 'timeout' | 'forbidden' | 'http' | 'parse' | 'rejected';

// One error type for every failed request. `kind` drives connection status;
// `message` is the bar's own wording when it sent one.
export class BarError extends Error {
  kind: FailureKind;
  status?: number;
  state?: BarState;
  constructor(kind: FailureKind, message: string, status?: number, state?: BarState) {
    super(message);
    this.name = 'BarError';
    this.kind = kind;
    this.status = status;
    this.state = state;
  }
  // The request may never have reached the bar, or its answer was lost.
  get connectionLost(): boolean {
    return this.kind === 'network' || this.kind === 'timeout';
  }
}

export type Fetch = typeof fetch;

export function normalizeHost(input: string): string {
  let host = input.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  host = host.split('/')[0];
  return host;
}

export function baseUrl(host: string): string {
  return 'http://' + normalizeHost(host);
}

async function request(fetcher: Fetch, url: string, init: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetcher(url, {...init, signal: controller.signal});
  } catch (error: any) {
    if (controller.signal.aborted) throw new BarError('timeout', 'The soundbar did not answer in time.');
    throw new BarError('network', error?.message || 'Unable to reach the soundbar.');
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 403) throw new BarError('forbidden', text.trim() || 'The soundbar refused this request.', 403);
    throw new BarError(response.ok ? 'parse' : 'http', text.trim() || 'Control unavailable. Refresh and try again.', response.status);
  }
}

export function validFeatures(value: any): value is Features {
  return !!value && value.schema === 1 && typeof value.model === 'string' && typeof value.name === 'string' &&
    Array.isArray(value.actions) && value.actions.every((a: unknown) => typeof a === 'string') &&
    Array.isArray(value.extensions) && value.extensions.every((item: any) => item && typeof item.id === 'string' && typeof item.included === 'boolean' &&
      (item.component === undefined || typeof item.component === 'string') && Array.isArray(item.actions) && item.actions.every((a: unknown) => typeof a === 'string'));
}

export interface Api {
  host: string;
  getState(): Promise<BarState>;
  getFeatures(): Promise<Features | null>;
  postAction(body: ActionBody, csrf: string): Promise<BarState>;
  eventsUrl(): string;
}

export function createApi(host: string, fetcher: Fetch = fetch): Api {
  const base = baseUrl(host);
  return {
    host: normalizeHost(host),
    async getState() {
      const response = await request(fetcher, base + '/api/state', {headers: {'Cache-Control': 'no-store'}}, TIMEOUTS.state);
      const data = await readJson(response);
      if (!response.ok) throw new BarError(response.status === 403 ? 'forbidden' : 'http', data?.error || 'Unable to reach the soundbar.', response.status);
      if (!data || typeof data !== 'object') throw new BarError('parse', 'The soundbar sent an unreadable state.');
      return data as BarState;
    },
    // Feature discovery is optional: an older remote without it stays usable.
    async getFeatures() {
      try {
        const response = await request(fetcher, base + '/api/features', {headers: {'Cache-Control': 'no-store'}}, TIMEOUTS.features);
        if (!response.ok) return null;
        const value = await response.json();
        return validFeatures(value) ? value : null;
      } catch {
        return null;
      }
    },
    async postAction(body, csrf) {
      const response = await request(fetcher, base + '/api/action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
        body: JSON.stringify(body),
      }, actionTimeout(body.action));
      const data = await readJson(response);
      if (!response.ok) {
        const state = data?.state && typeof data.state === 'object' && 'available' in data.state ? data.state as BarState : undefined;
        throw new BarError(response.status === 403 ? 'forbidden' : 'rejected', data?.error || 'Control unavailable.', response.status, state);
      }
      return data as BarState;
    },
    eventsUrl: () => base + '/api/events',
  };
}
