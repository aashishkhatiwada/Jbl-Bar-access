import type {BarState} from '../api/types';
import {sourceName} from './format';

const isVolume = (a: string | null) => a === 'volume_up' || a === 'volume_down';

// Wording identical to the web remote's success() so both read the same.
export function successMessage(action: string, s: BarState, name: string): string {
  if (action === 'eq_apply' && s.eq?.status === 'waiting') return 'Front EQ saved. It is applied when Standard audio plays.';
  if (action === 'eq_reset' || (action === 'eq_apply' && s.eq?.enabled === false)) return 'Original tuning restored.';
  if (action === 'eq_apply') return 'Front EQ applied.';
  if (action === 'night_toggle') return 'Night mode ' + (s.sound?.night ? 'on.' : 'off.');
  if (action === 'media_play') return 'Play requested.';
  if (action === 'media_pause') return 'Pause requested.';
  if (action === 'media_next') return 'Next track requested.';
  if (action === 'media_previous') return 'Previous track requested.';
  if (action === 'media_stop') return 'Stop requested.';
  if (isVolume(action)) return 'Volume ' + s.volume + (s.muted ? ' · sound muted' : '');
  if (action === 'mute') return s.muted ? 'Sound muted.' : 'Sound unmuted.';
  if (action === 'power') return s.power === 'On' ? 'Your soundbar is on.' : 'Soundbar is in standby.';
  if (action === 'bass_next') return 'Bass level ' + ((s.sound?.bass ?? 0) + 1) + ' selected.';
  if (action === 'bass_offset_set') return 'Bass offset saved for startup.';
  // The web says "Center level N" with the raw 0-based value; the panel shows
  // 1..6, so the app speaks the same number the panel shows.
  if (action === 'center_next') return 'Center level ' + ((s.sound?.center ?? 0) + 1) + ' selected.';
  if (action === 'atmos_next') return 'Atmos height: ' + ['Low', 'Mid', 'High'][s.sound?.atmos ?? -1] + '.';
  if (action === 'rear_next') return 'Rear speakers: ' + ['Low', 'Mid', 'High', 'Muted'][s.sound?.rear ?? -1] + '.';
  if (action === 'standard') return 'Standard selected. Smart Mode is off.';
  if (action === 'smart') return 'Smart Mode selected.';
  if (action === 'av_sync_set') return 'Audio sync ' + s.sound?.av_sync_ms + ' ms.';
  if (action === 'calibrate') return 'Calibration started. Keep the room quiet.';
  if (action === 'sub_pair') return 'Subwoofer pairing is open. Hold the button on the back of the subwoofer until it flashes white quickly.';
  if (action === 'input_bluetooth') return s.bluetooth?.connected ? 'Bluetooth selected. A device is connected.' : 'Bluetooth selected. Choose ' + (s.bluetooth?.name || name) + ' on your phone.';
  if (action === 'bluetooth_pair') return 'Pairing is open. Choose ' + (s.bluetooth?.name || name) + ' in your phone’s Bluetooth settings.';
  return sourceName(s.input) + ' selected.';
}

export interface PendingContext {
  queued: number;
  syncTarget: number | null;
  plan: {target: number; step: number; total: number} | null;
}

export function pendingMessage(active: string | null, c: PendingContext): string {
  if (active === 'eq_apply') return 'Applying front EQ…';
  if (active === 'eq_reset') return 'Restoring original tuning…';
  if (active === 'night_toggle') return 'Changing night mode… audio may briefly mute.';
  if (active?.startsWith('media_')) return 'Sending playback control…';
  if (isVolume(active) && c.plan) return 'Setting volume ' + c.plan.target + '… (' + c.plan.step + ' of ' + c.plan.total + ')';
  if (isVolume(active)) return 'Adjusting volume' + (c.queued ? ' · ' + c.queued + ' queued' : '') + '…';
  if (active === 'standard') return 'Selecting Standard… audio may briefly mute.';
  if (active === 'smart') return 'Selecting Smart Mode… audio may briefly mute.';
  if (active === 'av_sync_set') return 'Adjusting audio sync to ' + c.syncTarget + ' ms… other controls wait a few seconds.';
  if (active === 'calibrate') return 'Starting calibration…';
  if (active === 'sub_pair') return 'Opening subwoofer pairing…';
  if (active === 'input_bluetooth') return 'Switching to Bluetooth…';
  if (active === 'bluetooth_pair') return 'Starting Bluetooth pairing…';
  if (active === 'bass_offset_set') return 'Saving bass offset…';
  return active === 'power' ? 'Changing power state…' : 'Applying your change…';
}
