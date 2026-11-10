import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../components/Button';
import {Icon, type IconName} from '../../components/Icon';
import {ValueControl} from '../../components/ValueControl';
import {useController, useSnapshot} from '../../state/ControllerContext';
import {colors, font, radius} from '../../theme/tokens';
import {disabled, INPUTS, summary, volumeView} from '../../engine/view';
import {sourceName} from '../../engine/format';
import {SpeakerView} from './SpeakerView';
import {s} from './styles';

type ViewRef = React.ComponentRef<typeof View>;

export function Listening({volumeRef}: {volumeRef: React.RefObject<ViewRef | null>}) {
  const snap = useSnapshot();
  return (
    <View style={[s.panel, styles.listening]}>
      <View>
        <Text style={s.h1} accessibilityRole="header">Your listening room.</Text>
        <Text style={styles.summary} testID="summary">{summary(snap)}</Text>
      </View>
      <SpeakerView />
      <View style={styles.meta}>
        <Text style={s.caption}>Battery: last reported; may lag while speakers are off.</Text>
        <Text style={s.caption}>Bass setting, not measured audio.</Text>
      </View>
      <View style={styles.everyday}>
        <Inputs />
        <Volume volumeRef={volumeRef} />
      </View>
    </View>
  );
}

function Inputs() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state;
  return (
    <View>
      <View style={s.sectionHeading}>
        <Text style={s.h2Everyday} accessibilityRole="header">Source</Text>
        <Text style={styles.currentSource}>{st ? sourceName(st.input) : '—'}</Text>
      </View>
      <View style={styles.inputs}>
        {INPUTS.map(item => {
          const selected = st?.input === item.input;
          return (
            <AppButton
              key={item.action}
              accessibilityLabel={item.title + ', ' + item.subtitle}
              accessibilityHint={selected ? 'Current source' : 'Switch to this source'}
              accessibilityState={{selected, busy: snap.active === item.action}}
              disabled={disabled(snap, item.action)}
              onPress={() => c.enqueue(item.action)}
              style={[styles.input, selected && styles.inputSelected]}
              testID={item.action}>
              <Icon name={item.icon as IconName} color={selected ? colors.orange : colors.text} />
              <Text style={[styles.inputTitle, selected && styles.inputTitleSelected]}>{item.title}</Text>
              <Text style={styles.inputSub}>{item.subtitle}</Text>
              {selected ? (
                <View style={styles.check}>
                  <Icon name="check" size={12} color={colors.selectedText} />
                </View>
              ) : null}
              {selected ? <Text style={styles.selectedWord}>Selected</Text> : null}
            </AppButton>
          );
        })}
      </View>
      <Bluetooth />
    </View>
  );
}

function Bluetooth() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state;
  if (!st) return null;
  const selected = st.input === 'Bluetooth';
  const bt = st.bluetooth;
  const active = snap.active;
  if (!selected && !bt?.connected && active !== 'input_bluetooth') return null;
  const {ready, awake} = snap;
  const name = bt?.name || snap.deviceName;
  const pairing = active === 'bluetooth_pair';
  const discoverable = !!bt?.discoverable && !!bt?.connectable;
  const status = active === 'input_bluetooth' ? 'Switching to Bluetooth…' : pairing ? 'Starting pairing…' : !ready ? 'Connection unavailable' : !awake ? (st.power === 'Standby' ? 'Soundbar in standby' : 'Power state unavailable') : discoverable ? 'Ready to pair' : bt?.connected ? (selected && bt.audio === 'Streaming' ? 'Streaming audio' : selected && bt.audio === 'Paused' ? 'Stream suspended' : 'Device connected') : 'Bluetooth source selected';
  const peer = bt?.peer_name || 'A Bluetooth device';
  const help = !awake ? (st.power === 'Standby' ? 'Turn on the bar to connect a device.' : 'Power state is not reported; pairing is unavailable.') : !selected ? peer + ' is connected. Select Bluetooth above to listen.' : discoverable ? 'Choose ' + name + ' in your phone’s Bluetooth settings. The bar is discoverable now.' : bt?.connected ? peer + ' is connected. To use a different device, start pairing below.' : 'Open Bluetooth settings on your phone and choose ' + name + '. If it’s missing, start pairing below.';
  const label = pairing ? 'Starting…' : discoverable ? 'Pairing is open' : bt?.connected ? 'Pair another device' : 'Pair a device';
  const off = !ready || !awake || !selected || !!active || discoverable || !bt;
  const note = !selected ? 'Select Bluetooth above before starting pairing.' : !bt ? 'Bluetooth status is unavailable on this firmware.' : discoverable ? 'Waiting for a device. This status updates automatically.' : 'Pairing may disconnect the current Bluetooth device.';
  return (
    <View style={[styles.bt, discoverable && ready && awake && styles.btDiscoverable]} testID="bluetooth-panel">
      <View style={styles.btHeading}>
        <View style={styles.btDot} />
        <Text style={s.h3} accessibilityRole="header">{status}</Text>
      </View>
      <Text style={styles.btText}>{help}</Text>
      <AppButton disabled={disabled(snap, 'bluetooth_pair', off)} onPress={() => c.enqueue('bluetooth_pair')} style={styles.btButton} accessibilityLabel={label} testID="bluetooth_pair">
        <View style={styles.btButtonRow}>
          <Icon name="bluetooth" size={15} color={colors.text} />
          <Text style={s.smallButtonText}>{label}</Text>
        </View>
      </AppButton>
      <Text style={styles.btNote}>{note}</Text>
    </View>
  );
}

function Volume({volumeRef}: {volumeRef: React.RefObject<ViewRef | null>}) {
  const c = useController();
  const snap = useSnapshot();
  const v = volumeView(snap);
  const downOff = disabled(snap, 'volume_down');
  const upOff = disabled(snap, 'volume_up');
  const off = downOff && upOff;
  const muteOff = disabled(snap, 'mute');
  const muted = snap.state?.muted;
  const progress = v.plan ? 'Setting volume ' + v.plan.target + '… (' + Math.max(1, v.plan.step) + ' of ' + v.plan.total + ')' : v.adjusting ? 'Adjusting…' : '';
  return (
    <View style={styles.volume} testID="volume-panel">
      {/* Focus target for "Jump to controls". */}
      <View ref={volumeRef} accessible accessibilityRole="header" accessibilityLabel="Volume" collapsable={false}>
        <Text style={s.h2Everyday}>Volume</Text>
      </View>
      <ValueControl
        testID="volume"
        name="Volume"
        spec={{min: 0, max: 31, step: 1}}
        value={v.value}
        format={value => String(value)}
        spoken={value => 'Volume ' + value + ' of 31' + (muted ? ', sound muted' : '')}
        onCommit={target => c.setVolume(target)}
        onStep={direction => c.enqueue(direction === 1 ? 'volume_up' : 'volume_down')}
        onHoldStart={direction => c.startHold(direction === 1 ? 'volume_up' : 'volume_down')}
        onHoldEnd={() => c.stopHold()}
        disabled={off}
        downDisabled={downOff}
        upDisabled={upOff}
        stepLabels={{down: 'Volume down', up: 'Volume up'}}
        dialogTitle="Set volume"
        dialogNote="The bar changes volume one step at a time; a big change takes a few seconds."
        center={
          <View style={styles.readout} importantForAccessibility="no-hide-descendants">
            <View style={styles.readoutRow}>
              <Text style={styles.volumeNumber} testID="volume-value">{v.value == null ? '—' : v.value}</Text>
              {v.caption ? <Text style={styles.volumeCaption}>{v.caption}</Text> : null}
            </View>
            <Text style={styles.pending}>{progress || ' '}</Text>
          </View>
        }
      />
      <AppButton
        accessibilityLabel={v.muteLabel}
        accessibilityRole="switch"
        accessibilityState={{checked: muted === true, busy: snap.active === 'mute'}}
        disabled={muteOff}
        onPress={() => c.enqueue('mute')}
        style={[styles.mute, muted && styles.muteActive]}
        testID="mute">
        <View style={styles.muteRow}>
          <Icon name={muted ? 'muted' : 'volume'} size={15} color={muted ? colors.orange : colors.muted} />
          <Text style={[styles.muteText, muted && s.accentText]}>{v.muteLabel}</Text>
        </View>
      </AppButton>
      {snap.queue.length > 0 ? (
        <AppButton label="Clear queued taps" onPress={() => c.cancelQueued()} style={styles.clear} textStyle={styles.clearText} accessibilityHint={snap.queue.length + ' changes waiting'} testID="cancel-volume" />
      ) : null}
      <Text style={styles.hint}>{v.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listening: {paddingHorizontal: 18, paddingTop: 22, paddingBottom: 19},
  summary: {color: colors.muted, fontSize: font.small, marginTop: 8, lineHeight: 21},
  meta: {marginBottom: 18, gap: 2},
  everyday: {borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 18, gap: 24},
  currentSource: {color: colors.muted, fontSize: font.caption},
  inputs: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13},
  input: {flexGrow: 1, flexBasis: 90, minHeight: 84, paddingVertical: 13, paddingHorizontal: 5, gap: 5, backgroundColor: 'rgba(255,255,255,0.012)'},
  inputSelected: {backgroundColor: colors.selectedBg, borderColor: colors.selectedBorder},
  inputTitle: {color: colors.text, fontSize: font.control, textAlign: 'center'},
  inputTitleSelected: {color: colors.selectedText},
  inputSub: {color: colors.muted, fontSize: font.caption, textAlign: 'center'},
  check: {position: 'absolute', right: 5, top: 5},
  selectedWord: {color: colors.selectedText, fontSize: 11, letterSpacing: 0.4},
  bt: {marginTop: 16, padding: 14, backgroundColor: colors.btPanelBg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.button},
  btDiscoverable: {borderColor: colors.accentBorder},
  btHeading: {flexDirection: 'row', alignItems: 'center', gap: 7},
  btDot: {width: 5, height: 5, borderRadius: 3, backgroundColor: colors.orange},
  btText: {color: colors.muted, fontSize: font.small, lineHeight: 24, marginTop: 7},
  btButton: {marginTop: 12},
  btButtonRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
  btNote: {color: colors.muted, fontSize: font.caption, lineHeight: 22, marginTop: 7},
  volume: {},
  readout: {alignItems: 'center', minHeight: 61, justifyContent: 'center'},
  readoutRow: {flexDirection: 'row', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', justifyContent: 'center'},
  volumeNumber: {color: colors.text, fontSize: font.volume, fontWeight: '300', letterSpacing: -2, fontVariant: ['tabular-nums']},
  volumeCaption: {color: colors.orange, fontSize: font.caption, letterSpacing: 0.5, maxWidth: 90},
  pending: {color: colors.orange, fontSize: font.caption, textAlign: 'center'},
  mute: {marginTop: 8, backgroundColor: 'rgba(17,18,21,0.15)'},
  muteActive: {borderColor: colors.accentBorder},
  muteRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  muteText: {color: colors.muted, fontSize: font.small},
  clear: {marginTop: 8},
  clearText: {color: colors.text, fontSize: font.small},
  hint: {color: colors.subtle, fontSize: font.caption, lineHeight: 21, textAlign: 'center', marginTop: 10},
});
