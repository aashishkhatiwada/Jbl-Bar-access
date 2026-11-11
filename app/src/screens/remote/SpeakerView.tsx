import React from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {BatteryMeter, batteryLevel, LEVEL_WORD} from '../../components/BatteryMeter';
import {useSnapshot} from '../../state/ControllerContext';
import {colors, font, mono} from '../../theme/tokens';

const DISPLAY: Record<string, string> = {'TV / ARC': 'TV', HDMI: 'HDMI', Bluetooth: 'BT', Chromecast: 'CAST', AirPlay: 'AIR'};

// Pure presentation of reported state, ported from the web speakers
// component. The drawing is decorative; one text summary carries the state.
export function useSpeakerModel() {
  const snap = useSnapshot();
  const s = snap.state;
  const reachable = snap.reachable;
  const sound = s?.sound || {};
  const docked = reachable && typeof sound.rear_docked === 'boolean' ? sound.rear_docked : null;
  const sides = (['left', 'right'] as const).map(side => {
    const value = sound[side === 'left' ? 'rear_battery_left' : 'rear_battery_right'];
    const known = reachable && Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100;
    return {side, label: side === 'left' ? 'Left' : 'Right', value: known ? (value as number) : null, level: known ? batteryLevel(value) : 'unknown' as const};
  });
  const message = s?.setup?.subwoofer || '';
  const pairing = s?.setup?.sub_pairing === true;
  const bass = sound.bass;
  const knownBass = reachable && Number.isInteger(bass) && (bass as number) >= 0 && (bass as number) < 5;
  const showBass = knownBass && snap.awake && s?.muted === false && !pairing && !['Not connected', 'Reconnecting'].includes(message);
  const subStatus = !reachable ? 'Subwoofer · status unavailable' : pairing ? 'Subwoofer · pairing' : message ? 'Subwoofer · ' + message.toLowerCase() : 'Subwoofer';
  const caption = docked === null ? 'Docking state unavailable' : docked ? 'Rear speakers docked' : 'Rear speakers detached';
  const spokenSides = sides.map(b => 'Rear ' + b.label.toLowerCase() + ' ' + (b.value == null ? 'battery unavailable' : b.value + ' percent, ' + LEVEL_WORD[b.level])).join('. ');
  const summary = 'Speaker system. ' + spokenSides + '. ' + caption + (docked ? ', charging' : '') + '. ' + subStatus + '.' + (knownBass ? ' Bass setting ' + ((bass as number) + 1) + ' of 5.' : '');
  return {snap, docked, sides, showBass, knownBass, bass: bass as number, subStatus, caption, summary, inactive: !reachable || !snap.awake, display: !reachable || !snap.awake ? '' : DISPLAY[s?.input || ''] || ''};
}

export function SpeakerView() {
  const m = useSpeakerModel();
  const {fontScale} = useWindowDimensions();
  // Large text would overlap inside the drawing, so labels move below it.
  const inline = fontScale <= 1.3;
  const state = m.docked === null ? 'unknown' : m.docked ? 'docked' : 'detached';
  const bassOpacity = m.showBass ? 0.04 + (m.bass + 1) * 0.025 : 0;
  const batteryColor = state === 'docked' ? colors.orange : colors.batteryText;
  const battery = (b: (typeof m.sides)[number]) => (
    <View style={inline ? [styles.batteryInline, b.side === 'left' ? styles.batteryLeft : styles.batteryRight] : styles.batteryFlow} key={b.side}>
      <Text style={[styles.batteryText, {color: batteryColor}]} numberOfLines={1}>
        {b.label + ': ' + (b.value == null ? 'Unavailable' : b.value + '%')}
        {b.value != null && b.level !== 'normal' ? ' · ' + LEVEL_WORD[b.level] : ''}
      </Text>
      {b.value != null ? <BatteryMeter value={b.value} docked={state === 'docked'} /> : null}
    </View>
  );
  return (
    <View accessible accessibilityLabel={m.summary} testID="speaker-view">
      <View style={[styles.viz, m.inactive && styles.inactive]} importantForAccessibility="no-hide-descendants">
        <View style={styles.assembly}>
          <View style={[styles.rear, state === 'unknown' && styles.rearUnknown]}>
            <View style={[styles.speaker, styles.satLeft]}><Text style={styles.satLabel} allowFontScaling={false}>L</Text></View>
            {inline ? battery(m.sides[0]) : null}
          </View>
          <Break state={state} />
          <View style={[styles.speaker, styles.bar]}>
            <Text style={styles.barLogo} allowFontScaling={false}>JBL</Text>
            {m.display ? <Text style={styles.barDisplay} allowFontScaling={false}>{m.display}</Text> : null}
          </View>
          <Break state={state} />
          <View style={[styles.rear, state === 'unknown' && styles.rearUnknown]}>
            <View style={[styles.speaker, styles.satRight]}><Text style={styles.satLabel} allowFontScaling={false}>R</Text></View>
            {inline ? battery(m.sides[1]) : null}
          </View>
        </View>
        {inline ? <Text style={styles.rearCaption}>{m.caption}</Text> : null}
        <View style={styles.sub}>
          {m.showBass ? (
            <View style={styles.rings} pointerEvents="none">
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.ring, ringInsets[i], {opacity: bassOpacity * [1, 0.65, 0.3][i]}]} />
              ))}
            </View>
          ) : null}
          <View style={styles.subwoofer}><Text style={styles.subLogo} allowFontScaling={false}>JBL</Text></View>
          <View style={styles.subFeet} />
          {inline ? (
            <>
              <Text style={styles.subCaption} numberOfLines={1}>{m.subStatus}</Text>
              {m.knownBass ? <Text style={styles.bassCaption} numberOfLines={1}>BASS <Text style={styles.bassLevel}>{m.bass + 1} / 5</Text></Text> : null}
            </>
          ) : null}
        </View>
      </View>
      {!inline ? (
        <View style={styles.flow} importantForAccessibility="no-hide-descendants">
          <View style={styles.flowRow}>{m.sides.map(battery)}</View>
          <Text style={styles.flowText}>{m.caption}</Text>
          <Text style={styles.flowText}>{m.subStatus}{m.knownBass ? ' · Bass ' + (m.bass + 1) + ' / 5' : ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Break({state}: {state: string}) {
  return (
    <View style={[styles.break, state === 'docked' && styles.breakDocked, state === 'unknown' && styles.breakUnknown]}>
      <View style={[styles.breakLine, {transform: [{translateY: -2}]}]} />
      <View style={[styles.breakLine, {transform: [{translateY: 2}]}]} />
    </View>
  );
}

const ringInsets = [
  {top: '23%', bottom: '23%', left: '17%', right: '17%'},
  {top: '8%', bottom: '8%', left: '1%', right: '1%'},
  {top: '-8%', bottom: '-8%', left: '-15%', right: '-15%'},
] as const;

const speakerBase = {height: 22, borderWidth: 1, borderColor: colors.speakerEdge, backgroundColor: colors.speakerBody, borderTopColor: colors.speakerTop};

const styles = StyleSheet.create({
  viz: {height: 245, marginTop: 14, position: 'relative', overflow: 'hidden'},
  inactive: {opacity: 0.85},
  assembly: {position: 'absolute', left: 0, top: 130, width: '77%', height: 43, flexDirection: 'row', alignItems: 'flex-start'},
  rear: {width: '14%', position: 'relative', alignItems: 'center'},
  rearUnknown: {opacity: 0.6},
  speaker: speakerBase,
  satLeft: {width: '100%', borderTopLeftRadius: 9, borderBottomLeftRadius: 9, borderTopRightRadius: 3, borderBottomRightRadius: 3},
  satRight: {width: '100%', borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 9, borderBottomRightRadius: 9},
  satLabel: {position: 'absolute', alignSelf: 'center', bottom: 2, fontSize: 5, color: '#9397a2'},
  bar: {flex: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', minWidth: 0},
  barLogo: {fontSize: 6, fontWeight: '800', backgroundColor: colors.barLogoBg, paddingHorizontal: 2, color: colors.barLogo, letterSpacing: -0.6},
  barDisplay: {position: 'absolute', right: '7%', fontSize: 6, letterSpacing: 0.8, color: colors.barDisplay, backgroundColor: colors.barDisplayBg, paddingHorizontal: 2, fontFamily: mono},
  break: {width: 11, height: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3},
  breakDocked: {width: 3, opacity: 0},
  breakUnknown: {opacity: 0.2},
  breakLine: {width: 1, height: 8, backgroundColor: colors.orange, opacity: 0.55},
  // Labels hang inward from the outer edge so they never leave the drawing.
  batteryInline: {position: 'absolute', top: 52, gap: 6, width: 150},
  batteryLeft: {left: 0, alignItems: 'flex-start'},
  batteryRight: {right: 0, alignItems: 'flex-end'},
  batteryFlow: {alignItems: 'flex-start', gap: 6, marginRight: 24, marginTop: 6},
  batteryText: {fontSize: font.caption},
  rearCaption: {position: 'absolute', top: 214, left: '8%', width: '62%', textAlign: 'center', fontSize: font.caption, color: colors.captionReadable},
  sub: {position: 'absolute', top: 29, right: '4%', width: '18%', alignItems: 'stretch'},
  rings: {position: 'absolute', top: '70%', bottom: '-10%', left: '-12%', right: '-12%'},
  ring: {position: 'absolute', borderWidth: 1, borderColor: '#ee9b7c', borderRadius: 999},
  subwoofer: {height: 91, borderWidth: 1, borderColor: colors.subEdge, backgroundColor: colors.subBody, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 19},
  subLogo: {color: '#b2b3b9', fontSize: 6, fontWeight: '800', letterSpacing: -0.5},
  subFeet: {height: 5, marginHorizontal: 10, borderLeftWidth: 5, borderRightWidth: 5, borderColor: '#121316'},
  subCaption: {fontSize: font.caption, color: colors.subCaption, marginTop: 7, textAlign: 'right', width: 140, alignSelf: 'flex-end'},
  bassCaption: {fontSize: font.caption, letterSpacing: 0.7, color: colors.bassCaption, textAlign: 'right', width: 140, alignSelf: 'flex-end', marginTop: 7},
  bassLevel: {color: colors.orange, letterSpacing: 0.5},
  flow: {marginTop: 4, marginBottom: 8, gap: 6},
  flowRow: {flexDirection: 'row', flexWrap: 'wrap'},
  flowText: {color: colors.subCaption, fontSize: font.caption, lineHeight: 22},
});
