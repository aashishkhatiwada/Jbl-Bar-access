import type {BarState} from '../api/types';
import {supports} from './capabilities';
import type {Snapshot} from './controller';
import {sourceName} from './format';

// Presentation rules ported from the web render() and its components. Pure
// functions of the controller snapshot, so they can be tested and shared.

const isVolume = (a: string | null | undefined) => a === 'volume_up' || a === 'volume_down';

export function calibrating(s: BarState | null): boolean {
  return /starting|Starting in|Measuring/.test(s?.setup?.calibration || '');
}

// Right after wake the automation checks the mode, then may restore
// Standard: the bar refuses native controls meanwhile.
export function automationLock(snap: Snapshot): string | null {
  const s = snap.state;
  if (!snap.ready || !s?.automation?.enabled || !/^(AWAKE_STABILIZING_|APPLYING_STANDARD)/.test(s.automation.status || '')) return null;
  return s.automation.status === 'APPLYING_STANDARD' || (s.mode === 'Smart' && s.automation.remembered_mode !== 'Smart')
    ? 'Returning to Standard after wake… controls return in a few seconds.'
    : 'Checking the sound mode after wake… controls return in a few seconds.';
}

export function anyPending(snap: Snapshot): boolean {
  return snap.active !== null || snap.queue.length > 0 || snap.elsewhere;
}

// The shell's rule for every control with an action.
export function generalDisabled(snap: Snapshot, action: string): boolean {
  const s = snap.state;
  if (!s) return true;
  const pending = anyPending(snap);
  return !snap.ready || !['On', 'Standby'].includes(s.power || '') || (action !== 'power' && !snap.awake) ||
    (pending && !(isVolume(action) && isVolume(snap.active))) ||
    ((action === 'standard' || action === 'smart') && !['Standard', 'Smart'].includes(s.mode || ''));
}

// Locks applied after every component: calibration, automation, and actions
// the backend does not offer.
export function locked(snap: Snapshot, action: string): boolean {
  return calibrating(snap.state) || automationLock(snap) !== null || !supports(snap.features, action);
}

// Final disabled state. `own` is a component's own rule, which replaces the
// general rule exactly as in the web components.
export function disabled(snap: Snapshot, action: string, own?: boolean): boolean {
  const base = own === undefined ? generalDisabled(snap, action) : own;
  if (action === 'mute' && typeof snap.state?.muted !== 'boolean') return true;
  return base || locked(snap, action);
}

export type ConnectionState = 'online' | 'connecting' | 'offline';

export function connection(snap: Snapshot): {state: ConnectionState; label: string} {
  if (!snap.state) {
    if (snap.lastError) return {state: 'offline', label: 'Offline'};
    return {state: 'connecting', label: snap.everConnected ? 'Reconnecting' : 'Connecting'};
  }
  return snap.reachable ? {state: 'online', label: 'Connected'} : snap.online ? {state: 'connecting', label: 'Starting'} : {state: 'offline', label: 'Offline'};
}

export function summary(snap: Snapshot): string {
  const s = snap.state;
  const lock = automationLock(snap);
  if (lock) return lock;
  if (!s) {
    if (snap.lastError?.kind === 'forbidden') return 'This phone is not on the soundbar’s network. Join the same Wi-Fi (192.168.100.x).';
    return snap.lastError ? 'Waiting for your soundbar. Check the local connection.' : 'Connecting to your soundbar…';
  }
  const awake = s.power === 'On';
  return !snap.online ? 'Connection lost. Showing the last known settings.'
    : !s.available ? s.error || 'Waiting for your soundbar…'
    : snap.elsewhere ? 'Another control is running; controls return when it finishes.'
    : awake ? sourceName(s.input) + (['Smart', 'Standard'].includes(s.mode || '') ? ' · ' + s.mode + ' mode' : '')
    : s.power === 'Standby' ? 'In standby. Ready when you are.'
    : s.power === 'Starting' ? 'Your soundbar is starting…'
    : 'Connected. Power state is not reported.';
}

export function powerView(snap: Snapshot) {
  const s = snap.state;
  const awake = s?.power === 'On';
  const standby = s?.power === 'Standby';
  return {
    on: awake,
    accessibilityLabel: awake ? 'Put soundbar in standby' : standby ? 'Turn soundbar on' : 'Power state unavailable',
    label: snap.active === 'power' ? 'Working…' : awake ? 'Standby' : standby ? 'Turn on' : 'Power unknown',
  };
}

export function volumeView(snap: Snapshot) {
  const s = snap.state;
  const standby = s?.power === 'Standby';
  const knownPower = s?.power === 'On' || standby;
  const pending = anyPending(snap);
  const shown = s?.volume == null ? null : Math.max(0, Math.min(31, s.volume + snap.pendingVolume));
  return {
    value: shown,
    confirmed: s?.volume ?? null,
    caption: !s ? '' : standby ? 'IN STANDBY' : !knownPower ? 'POWER UNKNOWN' : s.muted ? 'SOUND MUTED' : '',
    adjusting: pending && isVolume(snap.active),
    hint: !s ? '' : standby ? 'Turn the bar on to adjust volume.' : !knownPower ? 'Power state is unavailable.' : s.muted ? 'Sound is muted. Tap above to unmute.' : 'Tap to adjust · hold to repeat.',
    muteLabel: snap.active === 'mute' ? 'Changing…' : typeof s?.muted !== 'boolean' ? 'Mute state unavailable' : s.muted ? 'Unmute sound' : 'Mute sound',
    plan: snap.volumePlan ? {...snap.volumePlan, step: snap.volumePlan.total - snap.queue.filter(isVolume).length} : null,
  };
}

export function lastSeen(snap: Snapshot, now = Date.now()): string {
  if (snap.streamOpen && snap.online) return 'Live updates';
  if (!snap.lastSync) return 'Not synced yet';
  const seconds = Math.floor((now - snap.lastSync) / 1000);
  return seconds < 5 ? 'Synced just now' : 'Synced ' + seconds + 's ago';
}

export const INPUTS = [
  {action: 'input_tv', input: 'TV / ARC', title: 'TV / ARC', subtitle: 'Television', icon: 'tv'},
  {action: 'input_hdmi', input: 'HDMI', title: 'HDMI', subtitle: 'Connected device', icon: 'hdmi'},
  {action: 'input_bluetooth', input: 'Bluetooth', title: 'Bluetooth', subtitle: 'Wireless audio', icon: 'bluetooth'},
] as const;
