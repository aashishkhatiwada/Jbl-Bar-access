import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {AppButton} from '../../components/Button';
import {Disclosure} from '../../components/Disclosure';
import {Picker} from '../../components/Picker';
import {ValueControl} from '../../components/ValueControl';
import {useController, useSnapshot} from '../../state/ControllerContext';
import {colors, font} from '../../theme/tokens';
import {disabled} from '../../engine/view';
import {componentIncluded} from '../../engine/capabilities';
import {EQ_LABELS, EQ_PRESETS, EQ_SPEC, EQ_SPOKEN, eqKey, eqView, PRESET_NAMES, presetOf, validGains} from '../../engine/eq';
import {OFFSET_SPEC, offsetKey, offsetView, validOffset} from '../../engine/bassOffset';
import {eqGain, signedDb, snap as snapTo} from '../../engine/format';
import {s} from './styles';

const spokenDb = (v: number) => (v < 0 ? 'minus ' : v > 0 ? 'plus ' : '') + Math.abs(v).toFixed(1).replace(/\.0$/, '') + ' decibels';
const shownDb = (v: number) => eqGain(v).replace('-', '−');

export function Tuning() {
  const snap = useSnapshot();
  if (!snap.state) return null;
  const eq = componentIncluded(snap.features, 'front-eq');
  const offset = componentIncluded(snap.features, 'bass-offset');
  if (!eq && !offset) return null;
  return (
    <View style={[s.panel, s.panelPad, styles.column]}>
      {eq ? <FrontEq /> : null}
      {offset ? <BassOffset /> : null}
    </View>
  );
}

// Draft state that resets whenever the confirmed value or session changes.
function useDraft<T>(key: string, initial: () => T): [T, (v: T) => void] {
  const [draft, setDraft] = useState<T>(initial);
  const last = useRef(key);
  useEffect(() => {
    if (last.current !== key) {
      last.current = key;
      setDraft(initial());
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [draft, setDraft];
}

function FrontEq() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state!;
  const confirmed = validGains(st.eq?.gains_db) ? st.eq!.gains_db!.slice() : null;
  const [draft, setDraft] = useDraft<number[] | null>(eqKey(snap), () => confirmed);
  const v = eqView(snap, draft);
  const setBand = (index: number, value: number) => {
    if (!v.canAdjust || !validGains(draft)) return;
    const next = draft.slice();
    next[index] = snapTo(value, EQ_SPEC.min, EQ_SPEC.max, EQ_SPEC.step);
    if (validGains(next)) setDraft(next);
  };
  const line = v.graph ? 'M' + v.graph.map(p => p.join(',')).join('L') : '';
  return (
    <View testID="eq-panel">
      <View style={s.sectionHeading}>
        <Text style={s.h2} accessibilityRole="header">Front EQ</Text>
        <Text style={s.tag}>Experimental</Text>
      </View>
      <Text style={styles.scope}>Front channels · cuts only · kept until Reset</Text>
      {v.graph ? (
        <View style={styles.graph} accessible accessibilityRole="image" accessibilityLabel={v.graphLabel}>
          <View style={styles.graphLabels} importantForAccessibility="no-hide-descendants">
            <Text style={s.caption}>0 dB</Text>
            <Text style={s.caption}>−6 dB</Text>
          </View>
          <Svg width="100%" height={64} viewBox="0 0 300 64" preserveAspectRatio="none" style={styles.graphSvg}>
            <Path d="M0 8H300M0 32H300M0 56H300" stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
            <Path d={line + 'L290,8L10,8Z'} fill="rgba(193,176,237,0.086)" stroke="none" />
            <Path d={line} stroke={colors.violet} strokeWidth={1.5} fill="none" />
          </Svg>
        </View>
      ) : null}
      <View style={styles.presetRow}>
        <Text style={styles.presetLabel}>Preset</Text>
        <View style={styles.presetPicker}>
          <Picker
            label="EQ preset"
            value={presetOf(draft)}
            disabled={!v.canAdjust}
            options={Object.keys(PRESET_NAMES).filter(k => k !== 'custom' || presetOf(draft) === 'custom').map(k => ({value: k, label: PRESET_NAMES[k]}))}
            onChange={preset => {
              if (Object.prototype.hasOwnProperty.call(EQ_PRESETS, preset)) setDraft(EQ_PRESETS[preset].slice());
            }}
            testID="eq-preset"
          />
        </View>
      </View>
      {EQ_LABELS.map((label, index) => (
        <View key={label} style={styles.band}>
          <Text style={styles.bandLabel}>{label + '  ·  ' + (v.draftValid ? shownDb(draft![index]) : '—')}</Text>
          <ValueControl
            testID={'eq-' + index}
            name={EQ_SPOKEN[index] + ' gain'}
            spec={EQ_SPEC}
            value={v.draftValid ? draft![index] : null}
            format={shownDb}
            spoken={value => spokenDb(value) + ', relative to original tuning'}
            showValue={false}
            onCommit={value => setBand(index, value)}
            onStep={direction => v.draftValid && setBand(index, draft![index] + direction * EQ_SPEC.step)}
            disabled={!v.canAdjust}
            stepLabels={{down: 'Cut ' + label + ' by 0.5 dB', up: 'Raise ' + label + ' by 0.5 dB'}}
            dialogTitle={'Set ' + label + ' gain'}
            dialogNote="−6 to 0 dB. Cuts only: typing 2.5 sets −2.5 dB. Apply EQ to listen."
          />
        </View>
      ))}
      <View style={styles.actions}>
        <AppButton
          label={v.applyLabel}
          disabled={disabled(snap, 'eq_apply', v.applyDisabled)}
          onPress={() => draft && c.enqueue('eq_apply', {gains: draft.slice()})}
          style={styles.apply}
          textStyle={styles.applyText}
          testID="eq-apply"
        />
        <AppButton label={v.resetLabel} disabled={disabled(snap, 'eq_reset', v.resetDisabled)} onPress={() => c.enqueue('eq_reset')} testID="eq-reset" />
      </View>
      <Text style={[styles.state, v.panelState === 'draft' && s.accentText]} testID="eq-state">{v.state}</Text>
      <Text style={styles.processing}>Uses custom DSP mode.</Text>
    </View>
  );
}

function BassOffset() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state!;
  const db = st.bass_offset?.offset_db;
  const [draft, setDraft] = useDraft<number>(offsetKey(snap), () => (validOffset(db) ? db : 0));
  const v = offsetView(snap, draft);
  const set = (value: number) => {
    const next = snapTo(value, OFFSET_SPEC.min, OFFSET_SPEC.max, OFFSET_SPEC.step);
    if (!v.disabled && validOffset(next)) setDraft(next);
  };
  return (
    <Disclosure title="Bass offset" tag="Experimental" initiallyOpen style={styles.offset} testID="bass-offset">
      <Text style={s.rowTitle}>Bass offset</Text>
      <Text style={s.rowValue} testID="bass-offset-state">{v.state}</Text>
      <View style={styles.offsetControl}>
        <ValueControl
          testID="bass-offset-control"
          name="Bass offset"
          spec={OFFSET_SPEC}
          value={v.known ? draft : null}
          format={value => signedDb(value).replace('-', '−')}
          spoken={value => spokenDb(value) + (v.changed ? ', not saved' : '')}
          onCommit={set}
          onStep={direction => set(draft + direction * OFFSET_SPEC.step)}
          disabled={v.disabled}
          stepLabels={{down: 'Lower bass offset by 0.5 dB', up: 'Raise bass offset by 0.5 dB'}}
          dialogTitle="Set bass offset"
          dialogNote="−3 to +3 dB in 0.5 dB steps. Then select Save offset."
        />
      </View>
      <AppButton label={v.saveLabel} disabled={disabled(snap, 'bass_offset_set', v.saveDisabled)} onPress={() => c.enqueue('bass_offset_set', {parameters: {offset_db: draft}})} testID="bass-offset-save" style={styles.save} textStyle={s.smallButtonText} />
      <Text style={s.note}>Offsets all five bass levels on supported Standard playback. Positive offsets can increase distortion.</Text>
    </Disclosure>
  );
}

const styles = StyleSheet.create({
  column: {paddingBottom: 6},
  scope: {color: colors.muted, fontSize: font.caption, lineHeight: 22, marginTop: 17},
  graph: {marginTop: 18, height: 75, paddingLeft: 40, flexDirection: 'row'},
  graphLabels: {position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'space-between', paddingVertical: 2},
  graphSvg: {flex: 1},
  presetRow: {flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, marginBottom: 14, flexWrap: 'wrap'},
  presetLabel: {color: colors.muted, fontSize: font.small},
  presetPicker: {flex: 1, minWidth: 160},
  band: {marginTop: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.line},
  bandLabel: {color: colors.muted, fontSize: font.small, marginBottom: 4},
  actions: {flexDirection: 'row', gap: 9, marginTop: 18, flexWrap: 'wrap'},
  apply: {flexGrow: 1, borderColor: colors.accentBorder, backgroundColor: colors.applyBg},
  applyText: {color: colors.applyText, fontSize: font.control},
  state: {color: colors.muted, fontSize: font.small, lineHeight: 24, marginTop: 13},
  processing: {color: colors.subtle, fontSize: font.caption, lineHeight: 22, marginTop: 6, marginBottom: 12},
  offset: {marginTop: 20},
  offsetControl: {marginTop: 12},
  save: {marginTop: 10},
});
