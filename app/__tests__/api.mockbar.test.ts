/**
 * @jest-environment node
 */
import {spawn, type ChildProcess} from 'child_process';
import path from 'path';
import {BarError, createApi} from '../src/api/client';
import {probe} from '../src/api/probe';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const HOST = '127.0.0.1:' + PORT;
let server: ChildProcess;
const realFetch = (globalThis as any).__realFetch || fetch;

beforeAll(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '../../mock-bar/server.js'), '--port', String(PORT), '--latency', '5'], {stdio: 'pipe'});
  await new Promise<void>(resolve => server.stdout!.once('data', () => resolve()));
});
afterAll(() => server.kill());

const scenario = (name: string) => realFetch('http://' + HOST + '/mock/scenario/' + name, {method: 'POST'});

describe('API client against mock-bar', () => {
  const api = createApi(HOST, realFetch);

  test('reads state and features', async () => {
    await scenario('normal');
    const s = await api.getState();
    expect(s.available).toBe(true);
    expect(typeof s.csrf).toBe('string');
    const f = await api.getFeatures();
    expect(f?.extensions.find(e => e.id === 'bar91.front-eq')?.included).toBe(true);
  });

  test('actions need the csrf token; a stale token is a plain-text 403', async () => {
    const s = await api.getState();
    const next = await api.postAction({action: 'volume_up'}, s.csrf!);
    expect(next.volume).toBe((s.volume ?? 0) + 1);
    await expect(api.postAction({action: 'volume_up'}, 'stale')).rejects.toMatchObject({kind: 'forbidden', message: 'Refresh the page before using controls'});
  });

  test('a rejected action carries the latest state for reconciliation', async () => {
    await scenario('standby');
    const s = await api.getState();
    try {
      await api.postAction({action: 'mute'}, s.csrf!);
      throw new Error('should reject');
    } catch (e) {
      expect(e).toBeInstanceOf(BarError);
      expect((e as BarError).state?.power).toBe('Standby');
    }
  });

  test('extension actions take parameters', async () => {
    await scenario('normal');
    const s = await api.getState();
    const next = await api.postAction({action: 'bar91.front-eq.apply', parameters: {gains_db: [-2, 0, 0, 0, -1]}}, s.csrf!);
    expect(next.extensions?.['bar91.front-eq'].gains_db).toEqual([-2, 0, 0, 0, -1]);
  });

  test('probe classifies connection states', async () => {
    await scenario('normal');
    expect((await probe(HOST, realFetch)).kind).toBe('connected');
    await scenario('restarting');
    expect((await probe(HOST, realFetch)).kind).toBe('restarting');
    expect((await probe('127.0.0.1:1', realFetch)).kind).toBe('offline');
    await scenario('normal');
  });
});
