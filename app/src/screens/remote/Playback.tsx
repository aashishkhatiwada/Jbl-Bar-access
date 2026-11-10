import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../components/Button';
import {Icon, type IconName} from '../../components/Icon';
import {useController, useSnapshot} from '../../state/ControllerContext';
import {colors, font} from '../../theme/tokens';
import {disabled} from '../../engine/view';
import {mediaTime} from '../../engine/format';

// Ported from the web playback component: shown only while a streaming
// source reports media (or Bluetooth is the input).
export function Playback() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state;
  if (!st || !snap.awake) return null;
  const bt = st.bluetooth;
  const bluetooth = st.input === 'Bluetooth';
  const playback = bluetooth ? {
    service: 'Bluetooth',
    status: bt?.connected == null ? 'Status unavailable' : !bt.connected ? 'Waiting for a device' : bt.audio === 'Streaming' ? 'Streaming audio' : bt.audio === 'Paused' ? 'Stream suspended' : 'Connected',
    active: !!bt?.connected && bt.audio === 'Streaming',
    detail: undefined as string | undefined,
    cast: undefined as any,
  } : st.streaming;
  if (!playback) return null;
  const cast = playback.cast;
  const {ready, awake, active} = snap;
  const title = bluetooth ? (bt?.connected ? bt.peer_name || 'Connected device' : '') : cast?.title || '';
  const metadata = bluetooth ? '' : [cast?.artist, cast?.album].filter(Boolean).join(' · ');
  const timed = !cast?.mirroring && Number.isFinite(cast?.duration) && cast.duration > 0 && Number.isFinite(cast?.current_time);
  const controls = st.media_controls || [];
  const airplay = playback.service === 'AirPlay';
  const intent = c.playback.intent;
  const wantsPause = bluetooth ? (intent ? intent === 'media_play' : bt?.audio === 'Streaming') : airplay ? (intent ? intent === 'media_play' : !!playback.active) : cast?.player_state === 'PLAYING';
  let toggle = wantsPause ? 'media_pause' : 'media_play';
  if (!controls.includes(toggle) && controls.includes(wantsPause ? 'media_play' : 'media_pause')) toggle = wantsPause ? 'media_play' : 'media_pause';
  const label = toggle === 'media_pause' ? 'Pause' : 'Play';
  const off = (action: string) => disabled(snap, action, !ready || !awake || !!active || !controls.includes(action));
  const help = controls.length ? (bluetooth ? 'Your app must support remote controls. Streaming may continue while an app is paused.' : airplay ? 'Sent to the AirPlay sender. Its play/pause state isn’t reported.' : 'Controls request changes from the receiver.') : cast?.mirroring ? 'Use playback controls in the sending app.' : bluetooth && bt?.connected ? 'Playback controls are unavailable for this connection.' : 'Playback controls aren’t available on this source.';
  const transport: {action: string; icon: IconName; label: string; text?: string}[] = [
    {action: 'media_previous', icon: 'previous', label: 'Previous track'},
    {action: toggle, icon: toggle === 'media_pause' ? 'pause' : 'play', label, text: label},
    {action: 'media_next', icon: 'next', label: 'Next track'},
    {action: 'media_stop', icon: 'stop', label: 'Stop playback'},
  ];
  const isActive = ready && awake && !!playback.active;
  return (
    <View style={[styles.panel, isActive && styles.active]} testID="playback" accessibilityLabel="Playback">
      <View style={styles.heading}>
        <Icon name={bluetooth ? 'bluetooth' : 'cast'} color={colors.orange} />
        <View style={styles.headingText}>
          <Text style={styles.service}>{playback.service || ''}</Text>
          <Text style={styles.status} accessibilityRole="header">{playback.status || ''}</Text>
        </View>
        {isActive ? <Text style={styles.playing}>Playing</Text> : null}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {metadata ? <Text style={styles.meta}>{metadata}</Text> : null}
      {cast?.application ? <Text style={styles.meta}>{cast.application}</Text> : null}
      {timed ? (
        <View style={styles.timeline} accessible accessibilityRole="progressbar" accessibilityLabel="Track progress" accessibilityValue={{min: 0, max: Math.round(cast.duration), now: Math.round(Math.min(cast.current_time, cast.duration)), text: mediaTime(cast.current_time) + ' of ' + mediaTime(cast.duration)}}>
          <View style={styles.track}><View style={[styles.fill, {width: `${(Math.min(cast.current_time, cast.duration) / cast.duration) * 100}%`}]} /></View>
          <Text style={styles.time}>{mediaTime(cast.current_time) + ' / ' + mediaTime(cast.duration)}</Text>
        </View>
      ) : null}
      <View style={styles.transport} accessibilityLabel="Playback controls">
        {transport.map(item => (
          <AppButton key={item.icon} accessibilityLabel={item.label} disabled={off(item.action)} onPress={() => c.enqueue(item.action)} style={styles.transportButton} testID={item.action}>
            <View style={styles.transportRow}>
              <Icon name={item.icon} size={15} color={colors.text} />
              {item.text ? <Text style={styles.transportLabel}>{item.text}</Text> : null}
            </View>
          </AppButton>
        ))}
      </View>
      <Text style={styles.help}>{help}</Text>
      {playback.detail ? <Text style={styles.meta}>{playback.detail}</Text> : null}
    </View>
  );
}

export function FeedbackRow() {
  const snap = useSnapshot();
  const {feedback} = snap;
  const color = feedback.kind === 'error' ? colors.danger : colors.feedbackReadable;
  const dot = feedback.kind === 'error' ? colors.danger : feedback.kind === 'pending' ? colors.orange : colors.green;
  const prefix = feedback.kind === 'error' ? 'Problem: ' : '';
  // Announced by useFeedbackAnnouncer, so this row is not a live region.
  return (
    <View style={styles.feedback} testID="feedback">
      <View style={[styles.dot, {backgroundColor: dot}]} />
      <Text style={[styles.feedbackText, {color}]} accessibilityLabel={prefix + feedback.text}>{feedback.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {marginTop: 19, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.047)', borderRadius: 11, backgroundColor: colors.insetBg},
  active: {borderColor: colors.accentBorder},
  heading: {flexDirection: 'row', alignItems: 'center', gap: 10},
  headingText: {flex: 1},
  service: {color: colors.muted, fontSize: font.caption},
  status: {color: colors.text, fontSize: font.control, fontWeight: '500', marginTop: 5},
  playing: {color: colors.orange, fontSize: font.caption},
  title: {color: colors.text, fontSize: 20, marginTop: 17},
  meta: {color: colors.muted, fontSize: font.small, marginTop: 7},
  timeline: {flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 16},
  track: {flex: 1, height: 4, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.063)', overflow: 'hidden'},
  fill: {height: 4, backgroundColor: colors.orange},
  time: {color: colors.muted, fontSize: font.caption},
  transport: {flexDirection: 'row', gap: 8, marginTop: 15},
  transportButton: {flex: 1, minWidth: 0, paddingHorizontal: 7},
  transportRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
  transportLabel: {color: colors.text, fontSize: font.caption},
  help: {color: colors.subtle, fontSize: font.caption, lineHeight: 22, marginTop: 12},
  feedback: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 47, paddingVertical: 10, paddingHorizontal: 3},
  dot: {width: 6, height: 6, borderRadius: 3},
  feedbackText: {flex: 1, fontSize: font.caption, lineHeight: 22},
});

