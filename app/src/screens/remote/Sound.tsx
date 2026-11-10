import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../components/Button';
import {Disclosure} from '../../components/Disclosure';
import {Segmented} from '../../components/Segmented';
import {ValueControl} from '../../components/ValueControl';
import {useController, useSnapshot} from '../../state/ControllerContext';
import {colors, font} from '../../theme/tokens';
import {disabled} from '../../engine/view';
import {componentIncluded} from '../../engine/capabilities';
import {LEVELS, type LevelName} from '../../engine/segments';
import {CENTER_DB} from '../../engine/format';
import {AV_SYNC_MAX} from '../../engine/controller';
import {s} from './styles';

export function Sound({headingRef}: {headingRef?: React.RefObject<React.ComponentRef<typeof View> | null>}) {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state;
  if (!st) return null;
  const sound = st.sound || {};
  const {ready, awake, active} = snap;
  const mode = st.mode;
  const modeTitle = mode === 'Standard' ? 'Standard' : mode === 'Smart' ? 'Smart Mode' : 'Checking mode';
  const modeDescription = st.power === 'Standby' ? 'Turn on to adjust your sound.' : !awake ? 'Power state is unavailable.' : active === 'standard' || active === 'smart' ? 'Selecting… audio may briefly mute.' : mode === 'Standard' ? 'Smart Mode is off.' : mode === 'Smart' ? 'Smart Mode adapts the sound to the content.' : 'Sound mode is not reported.';
  const modeTarget = active === 'smart' ? 'Smart' : active === 'standard' ? 'Standard' : undefined;
  const modeDisabled = disabled(snap, 'standard') && disabled(snap, 'smart');

  const level = (name: LevelName, title: string, valueText: string, extraOff = false, spoken?: (label: string) => string) => {
    const value = sound[name];
    const spec = LEVELS[name];
    // renderSegments only ever adds disabled on top of the shell rule.
    const off = disabled(snap, spec.action) || !ready || !awake || !!active || value == null || extraOff;
    return (
      <View style={s.row} key={name}>
        <View style={s.rowLabel}>
          <Text style={s.rowTitle}>{title}</Text>
          <Text style={s.rowValue}>{valueText}</Text>
        </View>
        <View style={s.rowControl}>
          <Segmented
            label={title === 'Bass' || title === 'Center' ? title + ' level' : title}
            options={spec.labels.map((label, i) => ({value: i, label, spoken: spoken ? spoken(label) : label}))}
            value={value as number | undefined}
            target={snap.targets[name]}
            disabled={off}
            onChange={v => c.choose(name, v)}
            testID={name}
          />
        </View>
      </View>
    );
  };

  const rear = ['Low', 'Mid', 'High', 'Muted'][sound.rear ?? -1] || 'Unavailable';
  const centerText = sound.center == null ? 'Unavailable' : 'Level ' + (sound.center + 1) + ' of 6 · ' + (sound.center ? '+' + CENTER_DB[sound.center] + ' dB' : 'original') + (sound.center_error ? ' · ' + sound.center_error : '');
  const nightOff = disabled(snap, 'night_toggle', !ready || !awake || !!active || sound.night == null);
  const night = sound.night === true;

  return (
    <View style={[s.panel, s.panelPad]} testID="sound-panel">
      <View style={s.sectionHeading}>
        <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel="Sound" collapsable={false}>
          <Text style={s.h2}>Sound</Text>
        </View>
      </View>
      <View style={styles.mode}>
        <Text style={s.h3}>{modeTitle}</Text>
        <Text style={styles.modeDescription}>{modeDescription}</Text>
        <View style={styles.modeSelect}>
          <Segmented
            label="Sound mode"
            large
            options={[{value: 'Standard', label: 'Standard'}, {value: 'Smart', label: 'Smart'}]}
            value={mode}
            target={modeTarget}
            disabled={modeDisabled}
            onChange={v => c.choose('mode', v)}
            testID="mode"
          />
        </View>
      </View>
      {level('bass', 'Bass', sound.bass == null ? 'Unavailable' : 'Level ' + (sound.bass + 1) + ' of 5', false, l => 'Level ' + l)}
      {componentIncluded(snap.features, 'center-level') ? level('center', 'Center', centerText, false, l => 'Level ' + l) : null}
      {level('atmos', 'Atmos height', ['Low', 'Mid', 'High'][sound.atmos ?? -1] || 'Unavailable')}
      {level('rear', 'Rear speakers', sound.rear_docked ? rear + ' · speakers docked' : rear, sound.rear_docked !== false)}
      <View style={s.row}>
        <View style={s.rowLabel}>
          <Text style={s.rowTitle}>Night mode</Text>
          <Text style={s.rowValue}>{sound.night == null ? 'Unavailable' : night ? 'On' : 'Off'}</Text>
        </View>
        <AppButton
          accessibilityRole="switch"
          accessibilityLabel="Night mode"
          accessibilityState={{checked: night, busy: active === 'night_toggle'}}
          accessibilityHint={active === 'night_toggle' ? 'Changing' : night ? 'Turns night mode off' : 'Turns night mode on'}
          disabled={nightOff}
          onPress={() => c.enqueue('night_toggle')}
          style={[s.smallButton, night && styles.nightOn]}
          testID="night">
          <Text style={[s.smallButtonText, night && s.accentText]}>{active === 'night_toggle' ? 'Changing…' : night ? 'Turn off' : 'Turn on'}</Text>
        </AppButton>
      </View>
      {awake && sound.audio_format ? (
        <View style={s.row} accessible testID="audio-format-row">
          <View style={s.rowLabel}>
            <Text style={s.rowTitle}>Audio format</Text>
            <Text style={s.rowValue}>{sound.audio_format}</Text>
          </View>
        </View>
      ) : null}
      <Text style={s.note}>Each intermediate level is confirmed. Center: level 1 is original; level 6 adds +12 dB. High levels may distort at loud volume. Height controls apply to Atmos audio.</Text>
      <AudioSync />
    </View>
  );
}

function AudioSync() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state!;
  const sync = st.sound?.av_sync_ms;
  const tvInput = st.source_state === 0 || st.source_state === 3;
  const draft = snap.avSyncDraft;
  const shown = draft ?? sync ?? null;
  const off = !snap.ready || !snap.awake || !!snap.active || sync == null || !tvInput;
  const valueText = sync == null ? 'Unavailable' : shown + ' ms' + (draft != null && draft !== sync ? ' (now ' + sync + ' ms)' : '') + (tvInput ? '' : ' · select TV or HDMI to adjust');
  const locked = disabled(snap, 'av_sync_set', off);
  return (
    <Disclosure title="Audio sync" initiallyOpen style={styles.advanced} testID="audio-sync">
      <View style={styles.syncHeader}>
        <Text style={s.rowTitle}>Audio sync</Text>
        <Text style={s.rowValue} testID="av-sync-value">{valueText}</Text>
      </View>
      <ValueControl
        testID="av-sync"
        name="Audio sync delay"
        spec={{min: 0, max: AV_SYNC_MAX, step: 10, unit: 'ms'}}
        value={shown}
        format={v => v + ' ms'}
        spoken={v => v + ' milliseconds' + (draft != null && draft !== sync ? ', not yet applied' : '')}
        onCommit={v => c.setAvSync(v, true)}
        onStep={direction => c.enqueue(direction === 1 ? 'av_sync_up' : 'av_sync_down')}
        disabled={locked}
        stepLabels={{down: 'Decrease audio delay by 10 ms', up: 'Increase audio delay by 10 ms'}}
        dialogTitle="Set audio sync delay"
        dialogNote="Rounded to 10 ms. Takes a few seconds plus about one second per step."
      />
      <Text style={s.note}>TV/HDMI lip sync · 10 ms steps. Tap +/−, drag, or type a value. Allow a few seconds, plus ~1 second per step. Other controls wait 5 seconds afterward.</Text>
    </Disclosure>
  );
}

const styles = StyleSheet.create({
  mode: {marginTop: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line},
  modeDescription: {color: colors.muted, fontSize: font.small, lineHeight: 22, marginTop: 6},
  modeSelect: {marginTop: 14},
  nightOn: {borderColor: 'rgba(238,155,124,0.27)'},
  advanced: {marginTop: 3, marginBottom: 6},
  syncHeader: {marginBottom: 10},
});
