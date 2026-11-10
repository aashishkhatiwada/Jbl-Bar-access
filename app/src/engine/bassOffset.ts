import type {BassOffsetState} from '../api/types';
import type {Snapshot} from './controller';
import {signedDb} from './format';
import {calibrating} from './view';

export const OFFSET_SPEC = {min: -3, max: 3, step: 0.5, unit: 'dB'};

export const validOffset = (db: unknown): db is number => typeof db === 'number' && Number.isFinite(db) && db >= -3 && db <= 3 && Number.isInteger(db * 2);

// The monitor reports why it waits as a code; say it in words.
const REASONS: Record<string, string> = {
  WAITING_FOR_STANDARD_PLAYBACK: '',
  WAITING_FOR_FRONT_EQ: 'Paused while a Front EQ is applied. Reset the Front EQ to use the bass offset.',
  WAITING_FOR_CALIBRATION: 'Paused during surround calibration.',
  WAITING_FOR_NATIVE_CONTROLS: 'Waiting for the current control to finish.',
  WAITING_FOR_AUDIO_ROUTE: 'Waiting for audio playback.',
  WAITING_FOR_SUPPORTED_DSP_MODE: 'Not supported in this sound mode or on this input.',
};

function explain(b: BassOffsetState): string {
  const reason = Object.prototype.hasOwnProperty.call(REASONS, b.error || '') ? REASONS[b.error || ''] : null;
  if (reason) return ' ' + reason;
  const status = b.status === 'waiting' ? ' Waiting for supported Standard playback.' : b.status === 'paused' ? ' Automatic adjustment paused.' : '';
  return status + (b.error && reason === null ? ' ' + b.error : '');
}

export function offsetKey(snap: Snapshot): string {
  const db = snap.state?.bass_offset?.offset_db;
  return JSON.stringify([snap.state?.csrf || snap.csrf, validOffset(db) ? db : null]);
}

export function offsetView(snap: Snapshot, draft: number) {
  const s = snap.state!;
  const b = s.bass_offset;
  const db = b?.offset_db;
  const known = validOffset(db);
  const pending = !!snap.active || snap.queue.length > 0;
  const disabled = !snap.ready || !known || pending || calibrating(s);
  const changed = known && draft !== db;
  return {
    known,
    disabled,
    changed,
    saveDisabled: disabled || !changed,
    saveLabel: snap.active === 'bass_offset_set' ? 'Saving…' : 'Save offset',
    state: !known ? 'Unavailable'
      : !snap.ready ? 'Last saved: ' + signedDb(db) + '. Connection unavailable.'
      : changed ? signedDb(draft) + ' selected. Select Save offset to keep it.'
      : signedDb(db) + ' set. ' + (b!.status === 'original' ? 'Original tuning.' : 'Saved for startup.') + explain(b!),
  };
}
