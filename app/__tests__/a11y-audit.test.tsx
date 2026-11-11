import React from 'react';
import {render, screen, act} from '@testing-library/react-native';
import {Controller} from '../src/engine/controller';
import {RemoteScreen} from '../src/screens/RemoteScreen';
import {baseState, FakeBar, flush} from './helpers/fakeBar';

// Renders the whole remote against a realistic bar state and checks every
// control a screen reader can reach: it must have a name and a role.
jest.mock('react-native-svg', () => {
  const R = require('react');
  const C = (p: any) => R.createElement('Svg', p, p.children);
  return {__esModule: true, default: C, Path: C, Circle: C, Rect: C};
});
jest.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));

let mockController: Controller;
jest.mock('../src/state/ControllerContext', () => {
  const actual = jest.requireActual('../src/state/ControllerContext');
  const R = require('react');
  return {
    ...actual,
    useController: () => mockController,
    useSnapshot: () => R.useSyncExternalStore(mockController.subscribe, mockController.getSnapshot),
  };
});

const STATE = baseState({
  input: 'Bluetooth', source_state: 2, mode: 'Smart',
  bluetooth: {name: 'Jbl bar 9.1', connected: true, peer_name: 'MacBook Pro', audio: 'Streaming'},
  media_controls: ['media_play', 'media_pause', 'media_next', 'media_previous'],
  setup: {sub_pairing: false, subwoofer: 'Connected', calibration: ''},
  eq: {available: true, enabled: false, gains_db: [0, 0, 0, 0, 0], status: 'original', kept: true},
  bass_offset: {offset_db: 0, status: 'original'},
  system: {sample: 3, cpu_percent: 22, cpu_cores: 4, memory: {total_bytes: 4e8, used_bytes: 2e8, available_bytes: 2e8}},
  wifi: {available: true, connected: true, ssid: 'home', ip: '192.168.100.25', signal_dbm: -56, frequency_mhz: 5745},
});

beforeEach(async () => {
  jest.useFakeTimers();
  const bar = new FakeBar(STATE);
  mockController = new Controller({host: 'x', api: bar.api(), stream: bar.streamFactory});
  await mockController.start();
  await flush();
});
afterEach(() => {
  mockController.dispose();
  jest.clearAllTimers();
  jest.useRealTimers();
});

const INTERACTIVE = new Set(['button', 'switch', 'radio', 'adjustable', 'link']);

test('every reachable control has a name and a role', async () => {
  await render(<RemoteScreen onSettings={() => {}} />);
  await act(async () => {});
  // Host tree: every node a screen reader treats as one focus stop.
  const all: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const hidden = n.props?.importantForAccessibility === 'no-hide-descendants';
    if (n.props && (n.props.accessible === true || n.props.onClick)) all.push({props: n.props});
    if (!hidden) walk(n.children);
  };
  walk(screen.toJSON());
  const problems: string[] = [];
  const names: string[] = [];
  for (const node of all) {
    const p = node.props;
    if (!p.onPress && !INTERACTIVE.has(p.accessibilityRole)) continue;
    if (!p.accessibilityRole) problems.push('no role: ' + (p.accessibilityLabel || p.testID));
    if (!p.accessibilityLabel) problems.push('no label: ' + (p.testID || p.accessibilityRole));
    names.push(p.accessibilityRole + ' · ' + p.accessibilityLabel);
  }
  expect(problems).toEqual([]);
  // A spot check that the main controls are present.
  for (const expected of ['Volume up', 'Volume down', 'Volume', 'Mute sound', 'Night mode', 'Audio sync delay', 'Bass offset', 'Put soundbar in standby', 'Pause']) {
    expect(names.some(n => n.endsWith(' · ' + expected))).toBe(true);
  }
  expect(names.some(n => n === 'button · Bluetooth, Wireless audio, selected')).toBe(true);
});
