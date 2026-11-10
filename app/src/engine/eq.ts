import type {Snapshot} from './controller';
import {eqGain} from './format';

export const EQ_SPEC = {min: -6, max: 0, step: 0.5, unit: 'dB'};
export const EQ_LABELS = ['125 Hz', '500 Hz', '2 kHz', '4 kHz', '8 kHz'];
export const EQ_SPOKEN = ['125 hertz', '500 hertz', '2 kilohertz', '4 kilohertz', '8 kilohertz'];

export const EQ_PRESETS: Record<string, readonly number[]> = {
  original: [0, 0, 0, 0, 0],
  less_bass: [-4, -2, 0, 0, 0],
  clear_dialogue: [-3, -1, 0, 0, -1],
  softer_treble: [0, 0, 0, -2, -3],
  warm: [0, 0, -1, -2, -3],
  bright: [-3, -2, -1, 0, 0],
  vocal_focus: [-4, -2, 0, -1, -2],
};
export const PRESET_NAMES: Record<string, string> = {
  original: 'Original', less_bass: 'Less bass', clear_dialogue: 'Clear dialogue', softer_treble: 'Softer treble',
  warm: 'Warm', bright: 'Bright', vocal_focus: 'Vocal focus', custom: 'Custom',
};

export function validGains(gains: unknown): gains is number[] {
  return Array.isArray(gains) && gains.length === 5 && gains.every(v => Number.isFinite(v) && v >= -6 && v <= 0 && Number.isInteger(v * 2));
}

// The draft resets whenever the confirmed EQ or the session changes.
export function eqKey(snap: Snapshot): string {
  const eq = snap.state?.eq || {};
  return JSON.stringify([snap.state?.csrf || snap.csrf, eq.enabled, validGains(eq.gains_db) ? eq.gains_db : null]);
}

export function presetOf(draft: number[] | null): string {
  if (!validGains(draft)) return 'custom';
  return Object.keys(EQ_PRESETS).find(name => EQ_PRESETS[name].every((v, i) => v === draft[i])) || 'custom';
}

export function eqView(snap: Snapshot, draft: number[] | null) {
  const s = snap.state!;
  const eq = s.eq || {};
  const {ready, awake, active, online} = snap;
  const valid = validGains(eq.gains_db);
  const draftValid = validGains(draft);
  const changed = valid && draftValid && draft.some((v, i) => v !== eq.gains_db![i]);
  const pending = !!active || snap.queue.length > 0;
  // A remote that keeps the EQ also saves one it cannot apply now and
  // applies it once Standard audio plays, so it stays adjustable.
  const keeps = typeof eq.kept === 'boolean' && eq.error !== 'EQ support is not installed';
  const applyNow = awake && eq.available === true;
  const saveLater = !applyNow && keeps;
  const canAdjust = ready && (applyNow || saveLater) && valid && !pending && eq.status !== 'reset_required';
  const forgetOnly = eq.kept === true && eq.enabled !== true && eq.status !== 'reset_required';
  const resetDisabled = !ready || (!awake && !forgetOnly) || pending || !(eq.enabled === true || eq.status === 'reset_required' || eq.kept === true);
  const panelState = !ready ? 'offline' : eq.status === 'reset_required' ? 'reset-required' : saveLater && valid ? (changed ? 'draft' : 'waiting') : !eq.available || !valid ? 'unavailable' : changed ? 'draft' : eq.enabled ? 'custom' : 'original';
  const offsetPaused = s.bass_offset?.error === 'WAITING_FOR_FRONT_EQ' && s.bass_offset.offset_db !== 0 ? ' Bass offset paused meanwhile.' : '';
  const notNow = !awake ? (s.power === 'Standby' ? 'The bar is in standby.' : 'Power state is unavailable.') : s.mode === 'Smart' ? 'Smart Mode is on.' : 'The EQ does not apply on this audio route.';
  const state = !online ? 'Offline. Reconnect to adjust EQ.'
    : !ready ? 'Waiting for the soundbar.'
    : saveLater && eq.status !== 'reset_required' ? (active === 'eq_apply' ? 'Saving your settings…' : changed ? 'Unsaved changes. Select Save EQ: it is applied when Standard audio plays.' : eq.status === 'waiting' && eq.error ? eq.error : notNow + ' Choose an EQ now: it is applied when Standard audio plays.')
    : !awake ? (s.power === 'Standby' ? 'Turn on the bar to adjust EQ.' : 'Power state is unavailable.')
    : eq.status === 'reset_required' ? 'Reset required before making further changes.'
    : eq.error ? eq.error
    : !eq.available || !valid ? 'EQ is unavailable on this firmware or audio path.'
    : active === 'eq_apply' ? 'Applying your settings…'
    : active === 'eq_reset' ? 'Restoring original processing…'
    : changed ? 'Unapplied changes. Select Apply EQ to listen.'
    : eq.enabled ? (eq.kept ? 'Custom EQ active. It stays through sound, input and power changes until Reset.' : 'Custom EQ active. Reset restores original processing.') + offsetPaused
    : 'Original tuning. Adjust a band, then apply.';
  const frequencies = Array.isArray(eq.frequencies_hz) && eq.frequencies_hz.length === 5 && eq.frequencies_hz.every(v => Number.isFinite(v) && v > 0) ? eq.frequencies_hz : [125, 500, 2000, 4000, 8000];
  const graph = draftValid ? draft.map((gain, i) => [10 + (Math.log2(frequencies[i] / 125) / 6) * 280, 8 - gain * 8] as [number, number]) : null;
  const graphLabel = draftValid ? (changed ? 'Unapplied' : eq.enabled ? 'Applied' : eq.status === 'waiting' ? 'Saved' : 'Original') + ' EQ gain settings: ' + draft.map((g, i) => EQ_SPOKEN[i] + ' ' + eqGain(g).replace('-', 'minus ')).join(', ') : '';
  return {
    valid, draftValid, changed, canAdjust, saveLater,
    applyDisabled: !canAdjust || !changed,
    applyLabel: active === 'eq_apply' ? (saveLater ? 'Saving…' : 'Applying…') : saveLater ? 'Save EQ' : 'Apply EQ',
    resetDisabled,
    resetLabel: active === 'eq_reset' ? 'Resetting…' : 'Reset',
    panelState, state, graph, graphLabel,
    statusWord: panelState === 'draft' ? 'Unapplied changes' : panelState === 'custom' ? 'Custom EQ active' : panelState === 'original' ? 'Original tuning' : panelState === 'waiting' ? 'Saved, waiting' : panelState === 'reset-required' ? 'Reset required' : panelState === 'offline' ? 'Offline' : 'Unavailable',
  };
}
