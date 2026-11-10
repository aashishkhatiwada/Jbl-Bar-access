import React, {useCallback, useEffect, useState} from 'react';
import {AppState, StyleSheet, Switch, Text, View} from 'react-native';
import {AppButton} from '../components/Button';
import {colors, font} from '../theme/tokens';
import type {Settings} from '../settings/store';
import {REAR_LOW_BATTERY_PERCENT} from './thresholds';
import {batteryOptimizationIgnored, loadMonitor, openBatteryOptimizationSettings, openNotificationSettings, permissionStatus, requestPermission, showLowBattery, type PermissionStatus} from './notify';
import type {MonitorState} from './monitor';

function when(ms: number): string {
  if (!ms) return 'Never';
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return seconds + ' s ago';
  if (seconds < 3600) return Math.round(seconds / 60) + ' min ago';
  return new Date(ms).toLocaleString();
}

const PERMISSION_TEXT: Record<PermissionStatus, string> = {granted: 'Allowed', denied: 'Blocked', 'not-asked': 'Not asked yet'};

export function NotificationSettings({settings, onSave}: {settings: Settings; onSave: (s: Settings) => void}) {
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [monitor, setMonitor] = useState<MonitorState | null>(null);
  const [optimized, setOptimized] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(() => {
    void permissionStatus().then(setPermission).catch(() => setPermission(null));
    void loadMonitor().then(setMonitor);
    void batteryOptimizationIgnored().then(v => setOptimized(v === null ? null : !v));
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', s => s === 'active' && refresh());
    const id = setInterval(refresh, 10000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [refresh]);

  const toggle = async (value: boolean) => {
    onSave({...settings, batteryAlerts: value});
    if (value && permission !== 'granted') setPermission(await requestPermission());
  };

  const test = async () => {
    let p = permission;
    if (p !== 'granted') p = await requestPermission();
    setPermission(p);
    if (p !== 'granted') {
      setMessage('Notifications are blocked. Allow them in Android settings first.');
      return;
    }
    await showLowBattery('left', REAR_LOW_BATTERY_PERCENT, true);
    setMessage('Test notification sent.');
  };

  const battery = (v: number | null | undefined) => (v == null ? 'unknown' : v + '%');
  return (
    <View style={styles.panel}>
      <Text style={styles.h2} accessibilityRole="header">Battery alerts</Text>
      <Text style={styles.caption}>Notifies you when a detached rear speaker reaches {REAR_LOW_BATTERY_PERCENT}% — the level at which the bar shows “REAR SPKR LOW BATT”. Once per speaker until it is charged again.</Text>
      <View style={styles.switchRow}>
        <Text style={styles.body} nativeID="alerts-label">Rear speaker low-battery alerts</Text>
        <Switch
          value={settings.batteryAlerts}
          onValueChange={v => void toggle(v)}
          accessibilityLabel="Rear speaker low-battery alerts"
          trackColor={{true: colors.orange, false: '#3a3f4a'}}
          thumbColor={colors.text}
          testID="alerts-switch"
        />
      </View>
      <Row label="Notification permission" value={permission ? PERMISSION_TEXT[permission] : 'Checking…'} />
      <Row label="Current battery" value={monitor ? 'Left ' + battery(monitor.battery.left) + ' · Right ' + battery(monitor.battery.right) + (monitor.docked ? ' · docked, charging' : monitor.docked === false ? ' · detached' : '') : '—'} />
      <Row label="Last check" value={monitor ? when(monitor.lastCheck) : '—'} />
      <Row label="Last battery reading" value={monitor ? when(monitor.lastSample) + (monitor.power && monitor.power !== 'On' ? ' · bar in ' + monitor.power.toLowerCase() : '') : '—'} />
      <Row label="Battery optimisation" value={optimized === null ? 'Unknown' : optimized ? 'On — checks may be delayed' : 'Off for this app'} />
      <View style={styles.actions}>
        <AppButton label="Send test notification" onPress={() => void test()} style={styles.flex} testID="alerts-test" />
        {permission === 'denied' ? <AppButton label="Open notification settings" onPress={() => void openNotificationSettings()} style={styles.flex} /> : null}
        {optimized ? <AppButton label="Allow background checks" accessibilityHint="Opens Android battery optimisation settings" onPress={() => void openBatteryOptimizationSettings()} style={styles.flex} /> : null}
      </View>
      {message ? <Text style={styles.caption} accessibilityLiveRegion="polite">{message}</Text> : null}
      <Text style={styles.limits}>
        Limits: while the app is open, alerts arrive as soon as the bar reports the level. In the background Android checks about every 15 minutes, and later in battery-saving (Doze) mode. No alert arrives if the app is force-stopped, if the phone is off the soundbar’s Wi-Fi, or while the bar is in standby. Battery levels are last reported values and can lag while the speakers sleep.
      </Text>
    </View>
  );
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={label + ': ' + value}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {borderWidth: 1, borderColor: 'rgba(255,255,255,0.043)', backgroundColor: colors.panel, borderRadius: 18, padding: 20, marginTop: 16},
  h2: {color: colors.text, fontSize: font.h2, fontWeight: '500'},
  caption: {color: colors.subtle, fontSize: font.small, lineHeight: 22, marginTop: 6},
  body: {color: colors.text, fontSize: font.body, flex: 1},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, marginTop: 10, borderBottomWidth: 1, borderBottomColor: colors.line},
  row: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line},
  rowLabel: {color: colors.subtle, fontSize: font.caption},
  rowValue: {color: colors.text, fontSize: font.control, marginTop: 3},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14},
  flex: {flexGrow: 1, flexBasis: 160},
  limits: {color: colors.subtle, fontSize: font.caption, lineHeight: 21, marginTop: 14},
});
