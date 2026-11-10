import type {BarState} from '../api/types';

// Bluetooth and AirPlay do not report play/pause after a command, so the
// last accepted transport action is remembered per peer until the peer or
// its audio state changes. Ported from the web playback component.
export class PlaybackIntent {
  intent: string | null = null;
  private peer = '';
  private audio = '';

  static identity(s: BarState | null | undefined): string {
    if (!s?.available || s.power !== 'On') return '';
    const bt = s.bluetooth;
    if (s.source_state === 7 && s.streaming?.service === 'AirPlay' && s.streaming.active) return 'airplay';
    return s.input === 'Bluetooth' && bt?.connected ? JSON.stringify([bt.peer_name || '', bt.name || '']) : '';
  }

  sync(s: BarState | null | undefined) {
    const peer = PlaybackIntent.identity(s);
    const audio = peer === 'airplay' ? 'Session active' : s?.bluetooth?.audio || '';
    if (!peer || peer !== this.peer || audio !== this.audio) this.intent = null;
    this.peer = peer;
    this.audio = audio;
  }

  reset() {
    this.intent = null;
  }

  accepted(action: string, requestPeer: string, state: BarState) {
    this.sync(state);
    if (requestPeer && requestPeer === PlaybackIntent.identity(state) && ['media_play', 'media_pause', 'media_stop'].includes(action)) this.intent = action;
  }
}
