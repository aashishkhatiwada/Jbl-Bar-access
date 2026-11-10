/**
 * Read-only check against the real bar. Runs only with LIVE_BAR=<host>.
 * @jest-environment node
 */
import {createApi} from '../src/api/client';
import {probe} from '../src/api/probe';
import {project} from '../src/engine/capabilities';

const host = process.env.LIVE_BAR;
const maybe = host ? describe : describe.skip;

maybe('live bar (read-only)', () => {
  test('state, features and probe', async () => {
    const api = createApi(host!);
    const [state, features] = await Promise.all([api.getState(), api.getFeatures()]);
    expect(typeof state.available).toBe('boolean');
    expect(features?.schema).toBe(1);
    const s = project(features, state);
    console.log(JSON.stringify({power: s.power, volume: s.volume, input: s.input, center: s.sound?.center, battery: [s.sound?.rear_battery_left, s.sound?.rear_battery_right], docked: s.sound?.rear_docked, eq: s.eq?.status, revision: s.revision}));
    expect((await probe(host!)).kind).toBe('connected');
  });
});
