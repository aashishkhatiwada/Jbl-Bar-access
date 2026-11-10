import React, {useRef} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../components/Button';
import {Disclosure} from '../../components/Disclosure';
import {Icon} from '../../components/Icon';
import {LineChart} from '../../components/LineChart';
import {useController, useSnapshot, useTicker} from '../../state/ControllerContext';
import {colors, font} from '../../theme/tokens';
import {calibrating, disabled, lastSeen} from '../../engine/view';
import {manual} from '../../engine/capabilities';
import {deviceUptime} from '../../engine/format';
import {MonitorHistory, monitorView} from '../../engine/monitor';
import {s} from './styles';

export function RoomSetup() {
  const c = useController();
  const snap = useSnapshot();
  const st = snap.state;
  const setup = st?.setup;
  if (!st || !setup) return null;
  const sound = st.sound || {};
  const {ready, awake, active} = snap;
  const measuring = calibrating(st);
  const calibration = setup.calibration || '';
  const calibrateOff = disabled(snap, 'calibrate', !ready || !awake || !!active || measuring || !!setup.sub_pairing || sound.rear_docked !== false);
  const pairOff = disabled(snap, 'sub_pair', !ready || !awake || !!active || measuring || !!setup.sub_pairing);
  return (
    <Disclosure title="Room setup" subtitle="Surround calibration & subwoofer pairing" border={false} style={[s.panel, styles.disclosurePanel]} summaryStyle={styles.summary} titleStyle={styles.summaryTitle} testID="room-setup">
      <View style={[s.row, styles.setupRow]}>
        <View style={s.rowLabel}>
          <Text style={s.rowTitle}>Surround calibration</Text>
          <Text style={s.rowValue}>{calibration || (sound.rear_docked === false ? 'Ready' : 'Undock both rear speakers first')}</Text>
        </View>
        <AppButton label="Calibrate" disabled={calibrateOff} onPress={() => c.enqueue('calibrate')} style={s.smallButton} textStyle={s.smallButtonText} testID="calibrate" />
      </View>
      <View style={[s.row, styles.setupRow]}>
        <View style={s.rowLabel}>
          <Text style={s.rowTitle}>Subwoofer</Text>
          <Text style={s.rowValue}>{setup.sub_pairing ? 'Pairing… hold the subwoofer button' : setup.subwoofer || '—'}</Text>
        </View>
        <AppButton label="Pair" accessibilityLabel="Pair subwoofer" disabled={pairOff} onPress={() => c.enqueue('sub_pair')} style={s.smallButton} textStyle={s.smallButtonText} testID="sub_pair" />
      </View>
      <Text style={s.note}><Text style={styles.strong}>Calibration.</Text> Undock both rears and keep the room quiet. Run two ~35-second steps: first at your listening position, then at their final positions. Other controls wait until calibration finishes.</Text>
      <Text style={s.note}><Text style={styles.strong}>Subwoofer pairing.</Text> Hold its rear button until it flashes white quickly. Pairing can take up to 3 minutes.</Text>
    </Disclosure>
  );
}

export function SystemMonitor() {
  const snap = useSnapshot();
  const now = useTicker(1000);
  const history = useRef(new MonitorHistory());
  if (!snap.state) return null;
  history.current.update(snap.state, snap.online, now);
  const v = monitorView(snap.state, snap.online, history.current, now);
  const cpuPoints = history.current.samples.map(p => ({time: p.time, value: p.cpu}));
  const ramPoints = history.current.samples.map(p => ({time: p.time, value: p.ram}));
  const statusColor = v.state === 'live' ? colors.green : v.state === 'offline' ? colors.danger : colors.subtle;
  return (
    <Disclosure
      title="System monitor"
      initiallyOpen
      border={false}
      style={[s.panel, styles.disclosurePanel]}
      summaryStyle={styles.summary}
      titleStyle={styles.summaryTitle}
      right={<Text style={[styles.monitorStatus, {color: statusColor}]}>{v.status}</Text>}
      rightSpoken={v.status}
      testID="system-panel">
      <View style={styles.metrics}>
        <View style={styles.metric} accessible accessibilityLabel={'CPU ' + v.cpu + ' utilization, ' + v.cpuDetail}>
          <View style={styles.metricHeading}><Text style={styles.metricTitle}>CPU</Text><Text style={s.caption}>{v.cpuDetail}</Text></View>
          <View style={styles.metricValue}><Text style={styles.metricNumber}>{v.cpu}</Text><Text style={s.caption}>utilization</Text></View>
        </View>
        <LineChart points={cpuPoints} now={now} color={colors.orange} fill="rgba(238,155,124,0.03)" label={v.cpuChartLabel} />
        <View style={styles.chartCaption} importantForAccessibility="no-hide-descendants"><Text style={s.caption}>Recent history</Text><Text style={s.caption}>0–100%</Text></View>
      </View>
      <View style={[styles.metrics, styles.metricGap]}>
        <View accessible accessibilityLabel={'RAM ' + v.ram + ' in use, ' + v.ramDetail + ', ' + v.ramAvailable}>
          <View style={styles.metricHeading}><Text style={styles.metricTitle}>RAM</Text><Text style={s.caption}>{v.ramDetail}</Text></View>
          <View style={styles.metricValue}><Text style={styles.metricNumber}>{v.ram}</Text><Text style={s.caption}>in use</Text></View>
        </View>
        <LineChart points={ramPoints} now={now} color={colors.green} fill="rgba(176,201,172,0.035)" label={v.ramChartLabel} />
        <View style={styles.chartCaption}><Text style={s.caption}>{v.ramAvailable}</Text><Text style={s.caption}>{v.historyCount}</Text></View>
      </View>
      <View style={styles.secondary}>
        <View accessible accessibilityLabel={'Storage, ' + v.storageDetail + ', ' + v.storageValue}>
          <View style={styles.metricHeading}><Text style={styles.metricTitle}>Storage</Text><Text style={s.caption}>{v.storageDetail}</Text></View>
          {v.storagePercent != null ? <View style={styles.progress}><View style={[styles.progressFill, {width: `${v.storagePercent}%`}]} /></View> : null}
          <Text style={[s.muted, styles.storageValue]}>{v.storageValue}</Text>
        </View>
        <View accessible accessibilityLabel={'Wi-Fi traffic. Received ' + v.receiveSpoken + '. Sent ' + v.transmitSpoken + '.'}>
          <Text style={styles.metricTitle}>Wi-Fi traffic</Text>
          <View style={styles.rates}>
            <View><Text style={styles.rate}><Text style={s.accentText}>↓  </Text>{v.receive}</Text><Text style={s.caption}>received</Text></View>
            <View><Text style={styles.rate}><Text style={s.accentText}>↑  </Text>{v.transmit}</Text><Text style={s.caption}>sent</Text></View>
          </View>
        </View>
      </View>
      <View style={styles.vitals}>
        <Vital label="Uptime" value={v.uptime} />
        <Vital label="Load" sub="1 / 5 / 15 min" value={v.load} />
        {v.processes != null ? <Vital label="Processes" value={v.processes} /> : null}
        {v.temperature != null ? <Vital label="Temperature" value={v.temperature} /> : null}
      </View>
      <Text style={s.caption}>{v.note}</Text>
      <View style={styles.wifi}>
        <View style={styles.wifiHeading} accessible accessibilityLabel={'Wi-Fi connection. ' + v.wifiName + '. ' + v.wifiStatus + '. Address ' + v.wifiIp + (v.wifiSignal ? '. ' + v.wifiSignal : '')}>
          <View style={styles.wifiIcon}><Icon name="wifi" color={colors.orange} /></View>
          <View style={styles.flex}>
            <Text style={s.caption}>Wi-Fi connection</Text>
            <Text style={s.body}>{v.wifiName}</Text>
            <Text style={[s.caption, {color: colors.muted}]}>{v.wifiStatus}</Text>
            <View style={styles.wifiDetails}><Text style={[s.caption, {color: colors.muted}]}>{v.wifiIp}</Text><Text style={[s.caption, {color: colors.muted}]}>{v.wifiSignal}</Text></View>
          </View>
        </View>
        {v.localAddress ? <Text style={[s.caption, styles.local]}>jbl.local</Text> : null}
        {v.hotspot ? <Text style={s.caption}>{v.hotspot}</Text> : null}
      </View>
    </Disclosure>
  );
}

function Vital({label, sub, value}: {label: string; sub?: string; value: string}) {
  return (
    <View accessible accessibilityLabel={label + (sub ? ', ' + sub : '') + ': ' + value.replace(/ \/ /g, ', ')}>
      <Text style={s.caption}>{label}{sub ? <Text style={s.caption}>{'  ' + sub}</Text> : null}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
    </View>
  );
}

const WATCHER: [RegExp | string, string][] = [
  ['PAUSING_LEGACY', 'Starting automation'],
  ['WAITING_FOR_READY', 'Waiting for sound controls'],
  ['ALREADY_STANDARD_THIS_WAKE', 'Already in Standard after wake'],
  ['WAITING_FOR_PROCESS', 'Waiting for the soundbar'],
  ['SMART_KEPT_THIS_WAKE', 'Smart Mode kept after wake'],
  ['MANUAL_MODE_THIS_WAKE', 'Your mode choice kept after wake'],
  ['APPLYING_STANDARD', 'Selecting Standard after wake…'],
];

export function watcherName(value: string | undefined, remembered: string): string {
  if (!value) return 'Not reported';
  if (value === 'STANDARD_THIS_WAKE') return remembered ? 'Standard restored after wake' : 'Standard selected after wake';
  if (value.startsWith('WAITING_POWER_') || value === 'WAITING_FOR_POWER_ON') return 'Waiting for power-on';
  if (value.startsWith('AWAKE_STABILIZING_')) return 'Checking the mode after wake…';
  if (value.startsWith('PROCESS_')) return 'Starting the watcher';
  const hit = WATCHER.find(([key]) => key === value);
  return hit ? hit[1] : 'Check automation logs';
}

export function Details({locales}: {locales: string[]}) {
  const snap = useSnapshot();
  const st = snap.state;
  if (!st) return null;
  const mode = ['Standard', 'Smart'].includes(st.automation?.remembered_mode || '') ? st.automation!.remembered_mode! : '';
  const automation = st.automation?.enabled ? st.automation.error || watcherName(st.automation.status, mode) + (mode ? ' · next wake: ' + mode : '') : watcherName(st.watcher, '');
  const cast = st.streaming?.cast;
  const gains = [cast?.low_shelf_gain, cast?.high_shelf_gain];
  const hasGains = gains.every(g => Number.isFinite(g));
  const pdf = manual(snap.features, locales);
  const rows: [string, string][] = [
    ['Bluetooth name', st.bluetooth?.name || 'Not reported'],
    ['Uptime', deviceUptime(st.uptime)],
    ['Smart Mode automation', automation],
  ];
  if (hasGains) rows.push(['Cast tone settings', 'Low ' + gains[0] + ' dB · High ' + gains[1] + ' dB (read only)']);
  return (
    <View style={styles.more}>
      <Disclosure title="Soundbar details" border={false} testID="device-details">
        {rows.map(([dt, dd]) => (
          <View key={dt} style={styles.dl} accessible accessibilityLabel={dt + ': ' + dd}>
            <Text style={[s.caption, styles.dt]}>{dt}</Text>
            <Text style={[s.muted, styles.dd]}>{dd}</Text>
          </View>
        ))}
        {pdf ? (
          <View style={styles.dl}>
            <Text style={[s.caption, styles.dt]}>Owner's manual</Text>
            <AppButton
              accessibilityRole="link"
              accessibilityLabel={'Owner’s manual, ' + pdf.label + ', opens JBL’s site'}
              onPress={() => void Linking.openURL(pdf.url)}
              style={styles.manual}>
              <Text style={s.body}>{pdf.label} <Text style={s.accentText}>↗</Text></Text>
            </AppButton>
          </View>
        ) : null}
      </Disclosure>
      <Disclosure title="Controls & tips" testID="help">
        <Help label="Volume." text="Tap +/−; hold to repeat. Drag the slider or use Set value to type a level; the bar steps there one confirmed step at a time. Clear queued taps cancels unsent changes." />
        <Help label="Bass offset (experimental)." text="Choose −3 to +3 dB in 0.5 dB steps, then Save offset. Applies to all five bass levels during supported Standard playback. Positive offsets may distort." />
        <Help label="Sound." text="Standard disables Smart Mode. Standard and Night Mode briefly hold mute to switch. Rear levels require detached speakers." />
        <Help label="Playback." text="Bluetooth controls your connected device; its stream may stay active while paused. Track details depend on the receiver. Mirrored Cast and AirPlay provide limited status." />
        <Help label="Local control." text="Live updates while this app is open. Power and source controls are experimental. Disconnecting clears pending changes; they’re never replayed." />
      </Disclosure>
    </View>
  );
}

function Help({label, text}: {label: string; text: string}) {
  return <Text style={styles.help}><Text style={styles.strong}>{label}</Text> {text}</Text>;
}

export function Footer() {
  const snap = useSnapshot();
  const now = useTicker(1000);
  return (
    <View style={styles.footer}>
      <Text style={s.caption}>Local control · No cloud.</Text>
      <Text style={s.caption} testID="last-seen">{lastSeen(snap, now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  disclosurePanel: {marginTop: 15, paddingHorizontal: 21},
  summary: {paddingVertical: 21},
  summaryTitle: {fontSize: font.body},
  setupRow: {minHeight: 70},
  strong: {color: colors.helpStrong, fontWeight: '600'},
  monitorStatus: {fontSize: font.caption},
  metrics: {padding: 17, backgroundColor: colors.metricBg, borderWidth: 1, borderColor: colors.line, borderRadius: 10},
  metricGap: {marginTop: 14},
  metric: {},
  metricHeading: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'},
  metricTitle: {color: colors.text, fontSize: font.control, fontWeight: '500'},
  metricValue: {flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 16},
  metricNumber: {color: colors.text, fontSize: font.metric, fontWeight: '300'},
  chartCaption: {flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 7, flexWrap: 'wrap'},
  secondary: {gap: 25, marginTop: 24},
  progress: {height: 4, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.063)', overflow: 'hidden', marginTop: 18, marginBottom: 11},
  progressFill: {height: 4, backgroundColor: colors.orange},
  storageValue: {color: colors.subtle},
  rates: {flexDirection: 'row', gap: 35, marginTop: 18, flexWrap: 'wrap'},
  rate: {color: colors.text, fontSize: font.body},
  vitals: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: 20, marginVertical: 25},
  vitalValue: {color: colors.vital, fontSize: font.control, marginTop: 8},
  wifi: {borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 20, marginTop: 20, marginBottom: 21, gap: 10},
  wifiHeading: {flexDirection: 'row', gap: 13, alignItems: 'flex-start'},
  wifiIcon: {width: 38, height: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  wifiDetails: {flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap'},
  local: {color: colors.orange, paddingLeft: 51},
  more: {marginTop: 12},
  dl: {flexDirection: 'row', flexWrap: 'wrap', gap: 15, paddingVertical: 9, alignItems: 'center'},
  dt: {width: 115},
  dd: {flex: 1, minWidth: 140},
  manual: {borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, alignItems: 'flex-start'},
  help: {color: colors.muted, fontSize: font.small, lineHeight: 25, marginBottom: 12},
  footer: {flexDirection: 'row', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8},
});

